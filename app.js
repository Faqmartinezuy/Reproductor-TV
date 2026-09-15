/* Antena TV. Requiere index.html, config.js, callback.html y Hls.js. */
'use strict';

/* Credenciales privadas configuradas directamente */
const CONFIG = window.ANTENA_CONFIG || {};
const localConfig = window.ANTENA_LOCAL_CONFIG || {
	usuario: 'william.s.martinez@hotmail.com',
	password: 'wilymanya1979'
};

const state = { token: null, jwtExp: 0, channels: [], current: null, hls: null, retry: 0, renew: null, streamRenew: null, popup: null };
const els = {};

function $(id) { return document.getElementById(id); }
function credentials() {
	const usuario = String(localConfig.usuario || '').trim();
	const password = String(localConfig.password || '');
	if (!usuario || !password) throw new Error('Faltan las credenciales locales.');
	return { usuario, password };
}
function hasLocalCredentials() {
	return Boolean(String(localConfig.usuario || '').trim() && String(localConfig.password || ''));
}
function jwtPayload(jwt) {
	try {
		const value = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
		return JSON.parse(decodeURIComponent(escape(atob(value + '=='.slice(0, (4 - value.length % 4) % 4)))));
	} catch (error) { return null; }
}
function parseStreamExpiry(streamUrl) {
	try {
		const match = streamUrl.match(/vxttoken=([^,]+),/);
		if (!match) return null;
		let value = match[1].replace(/-/g, '+').replace(/_/g, '/');
		value += '=='.slice(0, (4 - value.length % 4) % 4);
		const expiry = decodeURIComponent(atob(value)).match(/expiry=(\d+)/);
		return expiry ? parseInt(expiry[1], 10) : null;
	} catch (error) { return null; }
}
function encode(value) { return btoa(unescape(encodeURIComponent(value))); }
function decode(value) { return decodeURIComponent(escape(atob(value))); }
function storedCredentials() {
	const usuario = localStorage.getItem(CONFIG.STORAGE_KEYS?.usuario || 'tv_user');
	const password = localStorage.getItem(CONFIG.STORAGE_KEYS?.password || 'tv_pass');
	return usuario && password ? { usuario, password: decode(password) } : null;
}
function saveCredentials(value) {
	if (!CONFIG.STORAGE_KEYS) return;
	localStorage.setItem(CONFIG.STORAGE_KEYS.usuario, value.usuario);
	localStorage.setItem(CONFIG.STORAGE_KEYS.password, encode(value.password));
}
function clearStoredCredentials() {
	if (!CONFIG.STORAGE_KEYS) return;
	localStorage.removeItem(CONFIG.STORAGE_KEYS.usuario);
	localStorage.removeItem(CONFIG.STORAGE_KEYS.password);
}
function status(text, kind) {
	if (els.statusPill) {
		els.statusPill.textContent = text;
		els.statusPill.className = 'status-pill' + (kind ? ` is-${kind}` : '');
	}
}
function showScreen(name) {
	if (els.gateScreen) els.gateScreen.hidden = name !== 'gate';
	if (els.gridScreen) els.gridScreen.hidden = name !== 'grid';
	if (els.playerScreen) els.playerScreen.hidden = name !== 'player';
}
function showLoading(text) {
	if (els.loadingText) els.loadingText.textContent = text || 'Cargando...';
	if (els.loadingOverlay) els.loadingOverlay.classList.add('active');
}
function hideLoading() { if (els.loadingOverlay) els.loadingOverlay.classList.remove('active'); }
function showPlayerError(text) {
	hideLoading();
	if (els.playerErrorText) els.playerErrorText.textContent = text;
	if (els.playerErrorOverlay) els.playerErrorOverlay.hidden = false;
}
function hidePlayerError() { if (els.playerErrorOverlay) els.playerErrorOverlay.hidden = true; }
function showGateError(text) {
	if (els.gateError) {
		els.gateError.textContent = text;
		els.gateError.hidden = false;
	}
}
function setupGridKeyboardNav() {
	if (!els.channelGrid) return;
	els.channelGrid.addEventListener('keydown', event => {
		if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
		const cards = [...els.channelGrid.querySelectorAll('.channel-card')];
		const current = cards.indexOf(document.activeElement);
		if (current < 0) return;
		event.preventDefault();
		const origin = cards[current].getBoundingClientRect();
		let best = null;
		let bestDistance = Infinity;
		cards.forEach((card, index) => {
			if (index === current) return;
			const rect = card.getBoundingClientRect();
			const dx = rect.left + rect.width / 2 - (origin.left + origin.width / 2);
			const dy = rect.top + rect.height / 2 - (origin.top + origin.height / 2);
			const valid = event.key === 'ArrowRight' && dx > 4 || event.key === 'ArrowLeft' && dx < -4 || event.key === 'ArrowDown' && dy > 4 || event.key === 'ArrowUp' && dy < -4;
			if (!valid) return;
			const distance = Math.abs(dx) + Math.abs(dy) * 1.4;
			if (distance < bestDistance) { bestDistance = distance; best = card; }
		});
		if (best) best.focus();
	});
}

/**
 * Autenticación directa por POST a la API de Antel
 */
async function loginDirect() {
	const value = credentials();
	const loginUrl = CONFIG.LOGIN_API || 'https://veratv-be.vera.com.uy/api/login';
	
	const res = await fetch(loginUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
		body: JSON.stringify({ usuario: value.usuario.trim(), password: value.password })
	});

	if (!res.ok) {
		throw new Error(`LOGIN_API_${res.status}`);
	}

	const data = await res.json();
	return data.id_token || data.token || data.jwt;
}

async function createSession(jwtToken) {
	const value = credentials();
	const sessionUrl = CONFIG.SESSION_API || 'https://veratv-be.vera.com.uy/api/sesiones';

	const response = await fetch(sessionUrl, { 
		method: 'POST', 
		headers: { 'Content-Type': 'application/json' }, 
		body: JSON.stringify({ 
			usuario: value.usuario, 
			dominio: CONFIG.DOMINIO || 'anteltv.com.uy', 
			tipo: 'usuario', 
			autenticacion_jwt: jwtToken 
		}) 
	});

	if (!response.ok) throw new Error(`SESSION_API_${response.status}`);
	const data = await response.json(); 
	state.token = data.token;
	
	const payload = jwtPayload(data.jwt); 
	state.jwtExp = payload ? payload.exp : Math.floor(Date.now() / 1000) + 21600;

	if (state.renew) clearTimeout(state.renew);
	
	// Recarga programada 5 minutos (300.000 ms) antes del vencimiento
	const delay = Math.max((state.jwtExp * 1000) - Date.now() - (CONFIG.SESSION_RENEW_MARGIN_MS || 300000), 5000);
	state.renew = setTimeout(renewSession, delay);
}

async function renewSession() {
	try { 
		status('Renovando sesión...', 'warn'); 
		const idToken = await loginDirect();
		await createSession(idToken); 
		status('En vivo', 'live'); 
		if (state.current) await refreshStream(); 
	} catch (error) { 
		console.warn(error); 
		if (els.renewBanner) els.renewBanner.hidden = false; 
		status('Sesión vencida', 'error'); 
	}
}

async function loadGrid() {
	const gridUrl = CONFIG.GRID_API || 'https://veratv-be.vera.com.uy/api/contenidos';
	const response = await fetch(`${gridUrl}?token=${encodeURIComponent(state.token)}`);
	if (!response.ok) throw new Error(`GRID_API_${response.status}`);
	
	const data = await response.json(); 
	const items = data.contenidos || data.canales || (Array.isArray(data) ? data : []);
	
	state.channels = items.map(channel => ({ 
		publicId: channel.public_id || channel.id, 
		nombre: channel.nombre_fantasia || channel.nombre, 
		logo: channel.imagen_horizontal || channel.imagen_principal || channel.logo 
	})).filter(c => c.publicId);

	if (els.channelGrid) {
		els.channelGrid.replaceChildren(...state.channels.map(channel => {
			const button = document.createElement('button'); 
			button.type = 'button'; 
			button.className = 'channel-card'; 
			button.innerHTML = `<img class="channel-card-logo" src="${channel.logo}" alt="" loading="lazy"><span class="channel-card-name"></span>`; 
			button.querySelector('span').textContent = channel.nombre; 
			button.addEventListener('click', () => play(channel)); 
			return button;
		}));
	}
}

async function streamUrl(publicId) {
	const setupUrl = CONFIG.SETUP_API || 'https://veratv-be.vera.com.uy/api/setup';
	const response = await fetch(`${setupUrl}?token=${encodeURIComponent(state.token)}&public_id=${encodeURIComponent(publicId)}`);
	if (!response.ok) throw new Error(`SETUP_API_${response.status}`);
	
	const data = await response.json(); 
	return data.url?.suggested?.url || data.url_backup?.suggested?.url || data.url?.available?.[0]?.playbackUrl?.url || (() => { throw new Error('NO_STREAM_URL'); })();
}

async function refreshStream() {
	if (!state.current) return;
	const url = await streamUrl(state.current.publicId); 
	const video = els.videoPlayer;

	if (state.hls) state.hls.destroy();

	if (window.Hls && Hls.isSupported()) { 
		state.hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30, maxBufferLength: 30 }); 
		state.hls.attachMedia(video); 
		state.hls.on(Hls.Events.MANIFEST_PARSED, () => { hideLoading(); video.play().catch(() => {}); }); 
		state.hls.on(Hls.Events.ERROR, (event, data) => { 
			if (!data.fatal) return; 
			if (state.retry++ < (CONFIG.MAX_STREAM_RETRY || 3)) { 
				showLoading('Reconectando...'); 
				refreshStream().catch(() => showPlayerError('Se perdió la señal de este canal.')); 
			} else showPlayerError('Se perdió la señal de este canal.'); 
		}); 
		state.hls.loadSource(url); 
	} else if (video.canPlayType('application/vnd.apple.mpegurl')) { 
		video.src = url; 
		video.addEventListener('loadedmetadata', hideLoading, { once: true }); 
	} else {
		throw new Error('HLS_UNSUPPORTED');
	}

	if (state.streamRenew) clearTimeout(state.streamRenew);
	
	const expiry = parseStreamExpiry(url);
	// Renovación 5 minutos (300.000 ms) antes del vencimiento
	const delay = expiry ? Math.max(expiry * 1000 - Date.now() - (CONFIG.STREAM_RENEW_MARGIN_MS || 300000), 60000) : (CONFIG.STREAM_RENEW_INTERVAL_MS || 12600000);
	state.streamRenew = setTimeout(() => refreshStream().catch(error => console.warn('No se pudo renovar el stream:', error)), delay);
}

async function play(channel) { 
	state.current = channel; 
	state.retry = 0; 
	showScreen('player'); 
	if (els.playerChannelName) els.playerChannelName.textContent = channel.nombre; 
	showLoading('Sintonizando...'); 
	hidePlayerError(); 
	try { 
		await refreshStream(); 
	} catch (error) { 
		console.error(error); 
		showPlayerError('No se pudo cargar este canal. Puede que la sesión haya vencido.'); 
	} 
}

function stop() { 
	if (state.hls) { state.hls.destroy(); state.hls = null; } 
	if (state.streamRenew) { clearTimeout(state.streamRenew); state.streamRenew = null; } 
	if (els.videoPlayer) {
		els.videoPlayer.pause(); 
		els.videoPlayer.removeAttribute('src'); 
		els.videoPlayer.load(); 
	}
	state.current = null; 
}

async function start() { 
	status('Conectando...', 'warn'); 
	try { 
		const idToken = await loginDirect();
		await createSession(idToken); 
		await loadGrid(); 
		showScreen('grid'); 
		status('En vivo', 'live'); 
	} catch (error) { 
		console.error(error); 
		showGateError('No se pudo conectar con AntelTV: ' + error.message); 
		showScreen('gate'); 
	} 
}

function bootstrap() {
	['clock', 'statusPill', 'resetBtn', 'renewBanner', 'renewBtn', 'gateScreen', 'gateForm', 'gateUser', 'gatePass', 'gateError', 'gridScreen', 'channelGrid', 'gridEmpty', 'retryGridBtn', 'playerScreen', 'backBtn', 'playerChannelName', 'videoPlayer', 'loadingOverlay', 'loadingText', 'playerErrorOverlay', 'playerErrorText', 'playerRetryBtn'].forEach(id => { els[id] = $(id); });
	
	if (els.clock) setInterval(() => { els.clock.textContent = new Date().toLocaleTimeString('es-UY', { hour12: false }); }, 1000);
	
	els.gateForm?.addEventListener('submit', event => { 
		event.preventDefault(); 
		saveCredentials({ usuario: els.gateUser.value.trim(), password: els.gatePass.value }); 
		if (els.gateError) els.gateError.hidden = true; 
		start(); 
	});
	
	els.renewBtn?.addEventListener('click', renewSession);
	els.backBtn?.addEventListener('click', () => { stop(); showScreen('grid'); });
	els.playerRetryBtn?.addEventListener('click', () => { hidePlayerError(); if (state.current) play(state.current); });
	els.retryGridBtn?.addEventListener('click', () => { if (els.gridEmpty) els.gridEmpty.hidden = true; loadGrid().catch(() => { if (els.gridEmpty) els.gridEmpty.hidden = false; }); });
	els.resetBtn?.addEventListener('click', () => { clearStoredCredentials(); location.reload(); });
	
	document.querySelectorAll('[name="password"]').forEach(field => { field.type = 'password'; field.autocomplete = 'current-password'; });
	setupGridKeyboardNav();
	
	start();
}

document.addEventListener('DOMContentLoaded', bootstrap);

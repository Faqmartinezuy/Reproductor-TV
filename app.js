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
function hex(size) {
	const bytes = new Uint8Array(size);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
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
	const usuario = localStorage.getItem(CONFIG.STORAGE_KEYS.usuario);
	const password = localStorage.getItem(CONFIG.STORAGE_KEYS.password);
	return usuario && password ? { usuario, password: decode(password) } : null;
}
function saveCredentials(value) {
	localStorage.setItem(CONFIG.STORAGE_KEYS.usuario, value.usuario);
	localStorage.setItem(CONFIG.STORAGE_KEYS.password, encode(value.password));
}
function clearStoredCredentials() {
	if (!CONFIG.STORAGE_KEYS) return;
	localStorage.removeItem(CONFIG.STORAGE_KEYS.usuario);
	localStorage.removeItem(CONFIG.STORAGE_KEYS.password);
}
function status(text, kind) {
	els.statusPill.textContent = text;
	els.statusPill.className = 'status-pill' + (kind ? ` is-${kind}` : '');
}
function showScreen(name) {
	els.gateScreen.hidden = name !== 'gate';
	els.gridScreen.hidden = name !== 'grid';
	els.playerScreen.hidden = name !== 'player';
}
function showLoading(text) {
	if (els.loadingText) els.loadingText.textContent = text || 'Cargando...';
	els.loadingOverlay.classList.add('active');
}
function hideLoading() { els.loadingOverlay.classList.remove('active'); }
function showPlayerError(text) {
	hideLoading();
	els.playerErrorText.textContent = text;
	els.playerErrorOverlay.hidden = false;
}
function hidePlayerError() { els.playerErrorOverlay.hidden = true; }
function showGateError(text) {
	els.gateError.textContent = text;
	els.gateError.hidden = false;
}
function setupGridKeyboardNav() {
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

async function authorize(redirectUri) {
	const params = new URLSearchParams({
		client_id: CONFIG.CLIENT_ID, redirect_uri: redirectUri,
		response_type: 'id_token token', scope: 'openid', state: hex(16), nonce: hex(16), service: redirectUri,
	});
	const response = await fetch(`${CONFIG.OIDC_AUTHORIZE_URL}?${params}`);
	if (response.url.startsWith(redirectUri)) return { hash: new URL(response.url).hash };
	const html = await response.text();
	const match = html.match(/name="execution"\s+value="([^"]+)"/);
	if (!match) throw new Error('LOGIN_FORM_CHANGED');
	return { action: response.url, execution: match[1] };
}
function idToken(hash) {
	const token = new URLSearchParams(hash.replace(/^#/, '')).get('id_token');
	if (!token) throw new Error('NO_ID_TOKEN');
	return token;
}
async function login() {
	const value = credentials();
	const redirectUri = new URL('callback.html', document.baseURI).toString();
	const first = await authorize(redirectUri);
	if (first.hash) return idToken(first.hash);
	const popup = window.open('', 'antelAuthPopup', 'width=480,height=640');
	if (!popup) throw new Error('POPUP_BLOCKED');
	state.popup = popup;
	const result = new Promise((resolve, reject) => {
		const timeout = setTimeout(() => { window.removeEventListener('message', receive); reject(new Error('LOGIN_TIMEOUT')); }, CONFIG.LOGIN_POPUP_TIMEOUT_MS);
		function receive(event) {
			if (!event.data || event.data.source !== 'antel-callback') return;
			clearTimeout(timeout); window.removeEventListener('message', receive); resolve(event.data.hash);
		}
		window.addEventListener('message', receive);
	});
	const form = document.createElement('form');
	form.method = 'POST'; form.action = first.action; form.target = 'antelAuthPopup';
	Object.entries({ username: value.usuario, password: value.password, execution: first.execution, _eventId: 'submit', geolocation: '' }).forEach(([name, fieldValue]) => {
		const input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = fieldValue; form.appendChild(input);
	});
	const host = $('authFormHost'); host.replaceChildren(form); form.submit();
	const hash = await result;
	try { popup.close(); } catch (error) {}
	return idToken(hash);
}
async function createSession(token) {
	const value = credentials();
	const response = await fetch(CONFIG.SESSION_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: value.usuario, dominio: CONFIG.DOMINIO, tipo: 'usuario', autenticacion_jwt: token }) });
	if (!response.ok) throw new Error(`SESSION_API_${response.status}`);
	const data = await response.json(); state.token = data.token;
	const payload = jwtPayload(data.jwt); state.jwtExp = payload ? payload.exp : Math.floor(Date.now() / 1000) + 21600;
	if (state.renew) clearTimeout(state.renew);
	state.renew = setTimeout(renewSession, Math.max(state.jwtExp * 1000 - Date.now() - CONFIG.SESSION_RENEW_MARGIN_MS, 5000));
}
async function renewSession() {
	try { status('Renovando sesión...', 'warn'); await createSession(await login()); status('En vivo', 'live'); if (state.current) await refreshStream(); }
	catch (error) { console.warn(error); els.renewBanner.hidden = false; status('Sesión vencida', 'error'); }
}

async function loadGrid() {
	const response = await fetch(`${CONFIG.GRID_API}?token=${encodeURIComponent(state.token)}`);
	if (!response.ok) throw new Error(`GRID_API_${response.status}`);
	const data = await response.json(); state.channels = (data.contenidos || []).map(channel => ({ publicId: channel.public_id, nombre: channel.nombre_fantasia || channel.nombre, logo: channel.imagen_horizontal || channel.imagen_principal }));
	els.channelGrid.replaceChildren(...state.channels.map(channel => {
		const button = document.createElement('button'); button.type = 'button'; button.className = 'channel-card'; button.innerHTML = `<img class="channel-card-logo" src="${channel.logo}" alt="" loading="lazy"><span class="channel-card-name"></span>`; button.querySelector('span').textContent = channel.nombre; button.addEventListener('click', () => play(channel)); return button;
	}));
}
async function streamUrl(publicId) {
	const response = await fetch(`${CONFIG.SETUP_API}?token=${encodeURIComponent(state.token)}&public_id=${encodeURIComponent(publicId)}`);
	if (!response.ok) throw new Error(`SETUP_API_${response.status}`);
	const data = await response.json(); return data.url?.suggested?.url || data.url_backup?.suggested?.url || (() => { throw new Error('NO_STREAM_URL'); })();
}
async function refreshStream() {
	if (!state.current) return;
	const url = await streamUrl(state.current.publicId); const video = els.videoPlayer;
	if (state.hls) state.hls.destroy();
	if (window.Hls && Hls.isSupported()) { state.hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30, maxBufferLength: 30 }); state.hls.attachMedia(video); state.hls.on(Hls.Events.MANIFEST_PARSED, () => { hideLoading(); video.play().catch(() => {}); }); state.hls.on(Hls.Events.ERROR, (event, data) => { if (!data.fatal) return; if (state.retry++ < (CONFIG.MAX_STREAM_RETRY || 3)) { showLoading('Reconectando...'); refreshStream().catch(() => showPlayerError('Se perdió la señal de este canal.')); } else showPlayerError('Se perdió la señal de este canal.'); }); state.hls.loadSource(url); }
	else if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = url; video.addEventListener('loadedmetadata', hideLoading, { once: true }); }
	else throw new Error('HLS_UNSUPPORTED');
	if (state.streamRenew) clearTimeout(state.streamRenew);
	const expiry = parseStreamExpiry(url);
	const delay = expiry ? Math.max(expiry * 1000 - Date.now() - (CONFIG.STREAM_RENEW_MARGIN_MS || 300000), 60000) : (CONFIG.STREAM_RENEW_INTERVAL_MS || 12600000);
	state.streamRenew = setTimeout(() => refreshStream().catch(error => console.warn('No se pudo renovar el stream:', error)), delay);
}
async function play(channel) { state.current = channel; state.retry = 0; showScreen('player'); els.playerChannelName.textContent = channel.nombre; showLoading('Sintonizando...'); hidePlayerError(); try { await refreshStream(); } catch (error) { console.error(error); showPlayerError('No se pudo cargar este canal. Puede que la sesión haya vencido.'); } }
function stop() { if (state.hls) { state.hls.destroy(); state.hls = null; } if (state.streamRenew) { clearTimeout(state.streamRenew); state.streamRenew = null; } els.videoPlayer.pause(); els.videoPlayer.removeAttribute('src'); els.videoPlayer.load(); state.current = null; }
async function start() { status('Conectando...', 'warn'); try { await createSession(await login()); await loadGrid(); showScreen('grid'); status('En vivo', 'live'); } catch (error) { console.error(error); showGateError(error.message === 'POPUP_BLOCKED' ? 'Permití ventanas emergentes para este sitio.' : 'No se pudo conectar con AntelTV.'); showScreen('gate'); } }
function bootstrap() {
	['clock', 'statusPill', 'resetBtn', 'renewBanner', 'renewBtn', 'gateScreen', 'gateForm', 'gateUser', 'gatePass', 'gateError', 'gridScreen', 'channelGrid', 'gridEmpty', 'retryGridBtn', 'playerScreen', 'backBtn', 'playerChannelName', 'videoPlayer', 'loadingOverlay', 'loadingText', 'playerErrorOverlay', 'playerErrorText', 'playerRetryBtn'].forEach(id => { els[id] = $(id); });
	if (els.clock) setInterval(() => { els.clock.textContent = new Date().toLocaleTimeString('es-UY', { hour12: false }); }, 1000);
	els.gateForm?.addEventListener('submit', event => { event.preventDefault(); saveCredentials({ usuario: els.gateUser.value.trim(), password: els.gatePass.value }); els.gateError.hidden = true; start(); });
	els.renewBtn?.addEventListener('click', renewSession);
	els.backBtn?.addEventListener('click', () => { stop(); showScreen('grid'); });
	els.playerRetryBtn?.addEventListener('click', () => { hidePlayerError(); if (state.current) play(state.current); });
	els.retryGridBtn?.addEventListener('click', () => { if (els.gridEmpty) els.gridEmpty.hidden = true; loadGrid().catch(() => { if (els.gridEmpty) els.gridEmpty.hidden = false; }); });
	els.resetBtn?.addEventListener('click', () => { clearStoredCredentials(); location.reload(); });
	document.querySelectorAll('[name="password"]').forEach(field => { field.type = 'password'; field.autocomplete = 'current-password'; });
	setupGridKeyboardNav();
	if (hasLocalCredentials() || storedCredentials()) start(); else els.gridScreen.hidden = true;
}
document.addEventListener('DOMContentLoaded', bootstrap);

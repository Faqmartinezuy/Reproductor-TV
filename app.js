/* Antena TV. Requiere index.html, config.js, callback.html y Hls.js. */
'use strict';

const CONFIG = window.ANTENA_CONFIG || {};
const localConfig = window.ANTENA_LOCAL_CONFIG || {
	usuario: 'william.s.martinez@hotmail.com',
	password: 'wilymanya1979'
};

const state = { token: null, jwtExp: 0, channels: [], current: null, hls: null, retry: 0, renew: null, streamRenew: null };
const els = {};

function $(id) { return document.getElementById(id); }

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

/**
 * Genera la sesión conectando directamente al backend de Antel/Vera
 */
async function createSession() {
	const sessionUrl = CONFIG.SESSION_API || 'https://veratv-be.vera.com.uy/api/sesiones';

	// Enviamos la petición sin pasar por proxies que bloquee el navegador
	const response = await fetch(sessionUrl, { 
		method: 'POST', 
		headers: { 
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		}, 
		body: JSON.stringify({ 
			usuario: localConfig.usuario,
			password: localConfig.password,
			dominio: CONFIG.DOMINIO || 'anteltv.com.uy', 
			tipo: 'usuario' 
		}) 
	});

	// Si el backend requiere sesión anónima o falla el auth directo, obtenemos token público
	if (!response.ok) {
		const anonRes = await fetch(sessionUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ dominio: CONFIG.DOMINIO || 'anteltv.com.uy', tipo: 'anonimo' })
		});
		if (!anonRes.ok) throw new Error(`SESSION_FAILED_${response.status}`);
		const anonData = await anonRes.json();
		state.token = anonData.token;
		return;
	}

	const data = await response.json(); 
	state.token = data.token;
}

async function loadGrid() {
	const baseUrl = CONFIG.GRID_API || 'https://veratv-be.vera.com.uy/api/contenidos';
	const response = await fetch(`${baseUrl}?token=${encodeURIComponent(state.token || '')}`);
	
	if (!response.ok) throw new Error(`GRID_ERROR_${response.status}`);
	
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
			button.innerHTML = `<img class="channel-card-logo" src="${channel.logo || ''}" alt="" loading="lazy"><span class="channel-card-name"></span>`; 
			button.querySelector('span').textContent = channel.nombre; 
			button.addEventListener('click', () => play(channel)); 
			return button;
		}));
	}
}

async function streamUrl(publicId) {
	const setupUrl = CONFIG.SETUP_API || 'https://veratv-be.vera.com.uy/api/setup';
	const response = await fetch(`${setupUrl}?token=${encodeURIComponent(state.token || '')}&public_id=${encodeURIComponent(publicId)}`);
	
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
		showPlayerError('No se pudo cargar este canal.'); 
	} 
}

function stop() { 
	if (state.hls) { state.hls.destroy(); state.hls = null; } 
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
		await createSession(); 
		await loadGrid(); 
		showScreen('grid'); 
		status('En vivo', 'live'); 
	} catch (error) { 
		console.error('Error de inicio:', error); 
		showGateError('No se pudo conectar: ' + error.message); 
		showScreen('gate'); 
	} 
}

function bootstrap() {
	['clock', 'statusPill', 'resetBtn', 'renewBanner', 'renewBtn', 'gateScreen', 'gateForm', 'gateUser', 'gatePass', 'gateError', 'gridScreen', 'channelGrid', 'gridEmpty', 'retryGridBtn', 'playerScreen', 'backBtn', 'playerChannelName', 'videoPlayer', 'loadingOverlay', 'loadingText', 'playerErrorOverlay', 'playerErrorText', 'playerRetryBtn'].forEach(id => { els[id] = $(id); });
	
	if (els.clock) setInterval(() => { els.clock.textContent = new Date().toLocaleTimeString('es-UY', { hour12: false }); }, 1000);
	
	els.backBtn?.addEventListener('click', () => { stop(); showScreen('grid'); });
	els.playerRetryBtn?.addEventListener('click', () => { hidePlayerError(); if (state.current) play(state.current); });
	els.retryGridBtn?.addEventListener('click', () => { if (els.gridEmpty) els.gridEmpty.hidden = true; loadGrid().catch(() => { if (els.gridEmpty) els.gridEmpty.hidden = false; }); });
	
	start();
}

document.addEventListener('DOMContentLoaded', bootstrap);

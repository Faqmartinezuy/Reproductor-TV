/* Antena TV - Todo en uno (Sin dependencias externas) */
'use strict';

// 1. Configuración global y credenciales integradas
const APP_CONFIG = {
	usuario: 'william.s.martinez@hotmail.com',
	password: 'wilymanya1979',
	dominio: 'anteltv.com.uy',
	endpoints: {
		session: 'https://veratv-be.vera.com.uy/api/sesiones',
		grid: 'https://veratv-be.vera.com.uy/api/contenidos',
		setup: 'https://veratv-be.vera.com.uy/api/setup'
	}
};

const state = { token: null, channels: [], current: null, hls: null, retry: 0 };
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

function hideLoading() { 
	if (els.loadingOverlay) els.loadingOverlay.classList.remove('active'); 
}

function showPlayerError(text) {
	hideLoading();
	if (els.playerErrorText) els.playerErrorText.textContent = text;
	if (els.playerErrorOverlay) els.playerErrorOverlay.hidden = false;
}

function hidePlayerError() { 
	if (els.playerErrorOverlay) els.playerErrorOverlay.hidden = true; 
}

function showGateError(text) {
	if (els.gateError) {
		els.gateError.textContent = text;
		els.gateError.hidden = false;
	}
}

// 2. Creación de sesión directa en VeraTV sin auth externa ni popups
async function createSession() {
	try {
		const res = await fetch(APP_CONFIG.endpoints.session, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
			body: JSON.stringify({
				usuario: APP_CONFIG.usuario,
				password: APP_CONFIG.password,
				dominio: APP_CONFIG.dominio,
				tipo: 'usuario'
			})
		});

		if (res.ok) {
			const data = await res.json();
			state.token = data.token;
			return;
		}
	} catch (e) {
		console.warn('Fallo intento directo, usando sesión pública...', e);
	}

	// Fallback automático a token público/anónimo si el servidor bloquea el login
	const anonRes = await fetch(APP_CONFIG.endpoints.session, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ dominio: APP_CONFIG.dominio, tipo: 'anonimo' })
	});

	if (!anonRes.ok) throw new Error('No se pudo establecer sesión con VeraTV');
	const anonData = await anonRes.json();
	state.token = anonData.token;
}

// 3. Carga de lista de canales
async function loadGrid() {
	const res = await fetch(`${APP_CONFIG.endpoints.grid}?token=${encodeURIComponent(state.token || '')}`);
	if (!res.ok) throw new Error(`Error cargando lista (${res.status})`);

	const data = await res.json();
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

// 4. Obtención de señal m3u8 del canal seleccionado
async function getStreamUrl(publicId) {
	const res = await fetch(`${APP_CONFIG.endpoints.setup}?token=${encodeURIComponent(state.token || '')}&public_id=${encodeURIComponent(publicId)}`);
	if (!res.ok) throw new Error('No se pudo obtener el stream');

	const data = await res.json();
	return data.url?.suggested?.url || data.url_backup?.suggested?.url || data.url?.available?.[0]?.playbackUrl?.url;
}

async function refreshStream() {
	if (!state.current) return;
	const url = await getStreamUrl(state.current.publicId);
	if (!url) throw new Error('Señal no disponible');

	const video = els.videoPlayer;
	if (state.hls) state.hls.destroy();

	if (window.Hls && Hls.isSupported()) {
		state.hls = new Hls({ enableWorker: true, lowLatencyMode: true });
		state.hls.attachMedia(video);
		state.hls.on(Hls.Events.MANIFEST_PARSED, () => { hideLoading(); video.play().catch(() => {}); });
		state.hls.on(Hls.Events.ERROR, (event, data) => {
			if (data.fatal && state.retry++ < 3) {
				showLoading('Reconectando...');
				refreshStream().catch(() => showPlayerError('Error en la transmisión.'));
			}
		});
		state.hls.loadSource(url);
	} else if (video.canPlayType('application/vnd.apple.mpegurl')) {
		video.src = url;
		video.addEventListener('loadedmetadata', hideLoading, { once: true });
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
		showPlayerError('No se pudo reproducir este canal.');
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

// 5. Arranque automático directo
async function start() {
	status('Conectando...', 'warn');
	try {
		await createSession();
		await loadGrid();
		showScreen('grid');
		status('En vivo', 'live');
	} catch (error) {
		console.error(error);
		showGateError('Error al ingresar: ' + error.message);
		showScreen('gate');
	}
}

function bootstrap() {
	['clock', 'statusPill', 'resetBtn', 'renewBanner', 'renewBtn', 'gateScreen', 'gateForm', 'gateUser', 'gatePass', 'gateError', 'gridScreen', 'channelGrid', 'gridEmpty', 'retryGridBtn', 'playerScreen', 'backBtn', 'playerChannelName', 'videoPlayer', 'loadingOverlay', 'loadingText', 'playerErrorOverlay', 'playerErrorText', 'playerRetryBtn'].forEach(id => { els[id] = $(id); });

	if (els.clock) setInterval(() => { els.clock.textContent = new Date().toLocaleTimeString('es-UY', { hour12: false }); }, 1000);

	els.backBtn?.addEventListener('click', () => { stop(); showScreen('grid'); });
	els.playerRetryBtn?.addEventListener('click', () => { hidePlayerError(); if (state.current) play(state.current); });
	els.retryGridBtn?.addEventListener('click', () => { loadGrid().catch(() => {}); });

	start();
}

document.addEventListener('DOMContentLoaded', bootstrap);

/**
 * app.js — Reproductor Antel TV / Vera TV
 */

'use strict';

const DEFAULT_USER = 'william.s.martinez@hotmail.com';
const DEFAULT_PASS = 'wilymanya1979';

const state = {
  sessionToken: null,
  jwt: null,
  sessionJwtExp: null,
  currentCategory: null,
  channels: [],
  currentChannel: null,
  hls: null,
  streamRetryCount: 0,
  sessionRenewTimer: null,
  streamRenewTimer: null,
  orderMode: false,
  grabbedPublicId: null,
  dragCtx: null,
};

const els = {};

function $(id) { return document.getElementById(id); }

function getCredentials() {
  const userKey = (window.CONFIG && CONFIG.STORAGE_KEYS && CONFIG.STORAGE_KEYS.usuario) || 'antel_usuario';
  const passKey = (window.CONFIG && CONFIG.STORAGE_KEYS && CONFIG.STORAGE_KEYS.password) || 'antel_password_b64';

  localStorage.setItem(userKey, DEFAULT_USER);
  localStorage.setItem(passKey, btoa(DEFAULT_PASS));

  return { usuario: DEFAULT_USER, password: DEFAULT_PASS };
}

function parseJwtPayload(jwt) {
  try {
    const b64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '=='.slice(0, (4 - (b64.length % 4)) % 4);
    return JSON.parse(decodeURIComponent(escape(atob(padded))));
  } catch (e) { return null; }
}

function parseStreamExpiry(streamUrl) {
  try {
    const match = streamUrl.match(/vxttoken=([^,]+),/);
    if (!match) return null;
    let b64 = match[1].replace(/-/g, '+').replace(/_/g, '/');
    b64 += '=='.slice(0, (4 - (b64.length % 4)) % 4);
    const decoded = decodeURIComponent(atob(b64));
    const expMatch = decoded.match(/expiry=(\d+)/);
    return expMatch ? parseInt(expMatch[1], 10) : null;
  } catch (e) { return null; }
}

function setStatus(text, kind) {
  if (els.statusPill) {
    els.statusPill.textContent = text;
    els.statusPill.className = 'status-pill' + (kind ? ' is-' + kind : '');
  }
}

/* ================== SESIÓN Y AUTENTICACIÓN ================== */

async function loginAndCreateSession() {
  const creds = getCredentials();

  const res = await fetch(CONFIG.LOGIN_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: creds.usuario, password: creds.password }),
  });

  if (!res.ok) {
    let detail = 'HTTP ' + res.status;
    try {
      const errData = await res.json();
      if (errData.detail) detail = `${errData.step ? '[' + errData.step + '] ' : ''}${errData.detail}`;
    } catch (e) {}
    throw new Error(detail);
  }

  const loginData = await res.json();
  const { id_token, usuario, dominio } = loginData;

  const sessionRes = await fetch(CONFIG.SESSION_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usuario,
      dominio: dominio || CONFIG.DOMINIO,
      tipo: 'usuario',
      autenticacion_jwt: id_token,
    }),
  });

  if (!sessionRes.ok) {
    let detail = 'HTTP ' + sessionRes.status;
    try {
      const errData = await sessionRes.json();
      detail = errData.detail || errData.mensaje || errData.error || detail;
    } catch (e) {}
    throw new Error('SESSION_API: ' + detail);
  }

  const sessionData = await sessionRes.json();
  
  state.sessionToken = sessionData.token;
  state.jwt = sessionData.jwt;
  
  const payload = parseJwtPayload(sessionData.jwt);
  state.sessionJwtExp = payload ? payload.exp : (Math.floor(Date.now() / 1000) + 6 * 3600);
  scheduleSessionRenewal();
  return sessionData;
}

function scheduleSessionRenewal() {
  if (state.sessionRenewTimer) clearTimeout(state.sessionRenewTimer);
  const msUntilExpiry = state.sessionJwtExp * 1000 - Date.now();
  const delay = Math.max(msUntilExpiry - (CONFIG.SESSION_RENEW_MARGIN_MS || 300000), 5000);
  state.sessionRenewTimer = setTimeout(() => attemptRenewal(), delay);
}

async function attemptRenewal() {
  try {
    setStatus('Renovando sesión…', 'warn');
    await loginAndCreateSession();
    hideRenewBanner();
    setStatus('En vivo', 'live');
    if (state.currentChannel) await refreshStreamUrl();
  } catch (err) {
    console.warn('Renovación automática falló:', err);
    showRenewBanner();
  }
}

function showRenewBanner() {
  if (els.renewBanner) els.renewBanner.hidden = false;
  setStatus('Sesión vencida', 'error');
}

function hideRenewBanner() {
  if (els.renewBanner) els.renewBanner.hidden = true;
}

/* ================== GRILLA DE CANALES ================== */

function normalizeName(str) {
  return (str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function isExcludedChannel(nombre) {
  if (!CONFIG.EXCLUDED_CHANNELS || CONFIG.EXCLUDED_CHANNELS.length === 0) return false;
  const n = normalizeName(nombre);
  return CONFIG.EXCLUDED_CHANNELS.some(ex => normalizeName(ex) === n);
}

function applyDefaultChannelOrder(channels) {
  if (!CONFIG.CHANNEL_PRIORITY_ORDER) return channels;
  const rank = new Map(CONFIG.CHANNEL_PRIORITY_ORDER.map((n, i) => [normalizeName(n), i]));
  return channels.slice().sort((a, b) => {
    const ra = rank.has(normalizeName(a.nombre)) ? rank.get(normalizeName(a.nombre)) : Infinity;
    const rb = rank.has(normalizeName(b.nombre)) ? rank.get(normalizeName(b.nombre)) : Infinity;
    return ra - rb;
  });
}

function orderStorageKey(category) {
  return category === 'canales'
    ? (CONFIG.STORAGE_KEYS && CONFIG.STORAGE_KEYS.order) || 'tv_order'
    : ((CONFIG.STORAGE_KEYS && CONFIG.STORAGE_KEYS.order) || 'tv_order') + '_' + category;
}

async function loadGrid(category) {
  state.currentCategory = category;

  // Consulta la API de contenidos autorizados usando la URL base de CONFIG
  const url = `${CONFIG.GRID_API_BASE}?order=asc&order_by=vigencia_fin&token=${encodeURIComponent(state.sessionToken)}`;
  
  const res = await fetch(url, {
    headers: {
      ...CONFIG.GRID_HEADERS,
      'Authorization': 'Bearer ' + state.jwt
    }
  });

  if (!res.ok) {
    let errorDetail = 'HTTP ' + res.status;
    try {
      const errData = await res.json();
      errorDetail = errData.info || errData.detail || errorDetail;
    } catch (e) {}
    throw new Error('GRID_API_' + res.status + ': ' + errorDetail);
  }

  const data = await res.json();
  const rawList = Array.isArray(data) ? data : (data.contenidos || []);

  let fetched = rawList.map(c => ({
    publicId: c.public_id,
    nombre: c.nombre_fantasia || c.nombre,
    logo: c.imagen_horizontal || c.imagen_principal || c.imagen_cuadrada,
  }));

  if (category === 'canales') {
    fetched = fetched.filter(ch => !isExcludedChannel(ch.nombre));
  }

  state.channels = applySavedOrder(fetched, category);
  renderGrid();
  if (els.gridTitle) els.gridTitle.textContent = CONFIG.CATEGORY_LABELS[category] || '';

  if (els.channelGrid) {
    const firstCard = els.channelGrid.querySelector('.channel-card');
    if (firstCard) firstCard.focus();
  }
}

function applySavedOrder(channels, category) {
  const base = category === 'canales' ? applyDefaultChannelOrder(channels) : channels;
  const raw = localStorage.getItem(orderStorageKey(category));
  if (!raw) return base;
  let savedIds;
  try { savedIds = JSON.parse(raw); } catch (e) { return base; }
  const rank = new Map(savedIds.map((id, i) => [id, i]));
  return base.slice().sort((a, b) => {
    const ra = rank.has(a.publicId) ? rank.get(a.publicId) : Infinity;
    const rb = rank.has(b.publicId) ? rank.get(b.publicId) : Infinity;
    return ra - rb;
  });
}

function renderGrid() {
  const grid = els.channelGrid;
  if (!grid) return;
  grid.innerHTML = '';
  grid.classList.toggle('order-mode', state.orderMode);

  state.channels.forEach((ch) => {
    const card = document.createElement('button');
    card.className = 'channel-card';
    card.type = 'button';
    card.setAttribute('role', 'listitem');
    card.dataset.publicId = ch.publicId;
    if (state.grabbedPublicId === ch.publicId) card.classList.add('is-grabbed');
    card.innerHTML = `
      <img class="channel-card-logo" src="${ch.logo || ''}" alt="" loading="lazy">
      <span class="channel-card-name">${ch.nombre}</span>
    `;

    card.addEventListener('click', () => {
      playChannel(ch);
    });

    grid.appendChild(card);
  });
}

/* ================== REPRODUCTOR HLS ================== */

async function playChannel(ch) {
  state.currentChannel = ch;
  state.streamRetryCount = 0;
  showScreen('player');
  if (els.playerChannelName) els.playerChannelName.textContent = ch.nombre;
  showPlayerLoading('Sintonizando…');
  hidePlayerError();

  try {
    await refreshStreamUrl();
  } catch (err) {
    console.error(err);
    showPlayerError('No se pudo cargar este canal.');
  }
}

async function fetchStreamUrl(publicId) {
  const url = `${CONFIG.SETUP_API}?token=${encodeURIComponent(state.sessionToken)}&public_id=${encodeURIComponent(publicId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('SETUP_API_' + res.status);
  const data = await res.json();
  const primary = data.url && data.url.suggested && data.url.suggested.url;
  const backup = data.url_backup && data.url_backup.suggested && data.url_backup.suggested.url;
  if (!primary && !backup) throw new Error('NO_STREAM_URL');
  return primary || backup;
}

async function refreshStreamUrl() {
  if (!state.currentChannel) return;
  const streamUrl = await fetchStreamUrl(state.currentChannel.publicId);
  loadIntoPlayer(streamUrl);
  scheduleStreamRenewal(streamUrl);
}

function loadIntoPlayer(streamUrl) {
  const video = els.videoPlayer;
  if (!video) return;
  if (state.hls) { state.hls.destroy(); state.hls = null; }

  if (window.Hls && Hls.isSupported()) {
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 30,
      maxBufferLength: 30,
    });

    state.hls = hls;
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      hidePlayerLoading();
      video.play().catch(() => {});
    });

    hls.on(Hls.Events.ERROR, (evt, data) => {
      if (!data.fatal) return;
      if (state.streamRetryCount < (CONFIG.MAX_STREAM_RETRY || 3)) {
        state.streamRetryCount++;
        showPlayerLoading('Reconectando…');
        refreshStreamUrl().catch(() => showPlayerError('Se perdió la señal de este canal.'));
      } else {
        showPlayerError('Se perdió la señal de este canal.');
      }
    });

    hls.loadSource(streamUrl);
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = streamUrl;
    video.addEventListener('loadedmetadata', hidePlayerLoading, { once: true });
    video.play().catch(() => {});
  } else {
    showPlayerError('Este navegador no soporta reproducción HLS.');
  }
}

function scheduleStreamRenewal(streamUrl) {
  if (state.streamRenewTimer) clearTimeout(state.streamRenewTimer);
  const expiry = parseStreamExpiry(streamUrl);
  let delay = expiry ? Math.max(expiry * 1000 - Date.now() - (CONFIG.STREAM_RENEW_MARGIN_MS || 60000), 60000) : 3.5 * 60 * 60 * 1000;
  state.streamRenewTimer = setTimeout(() => {
    refreshStreamUrl().catch(err => console.warn('No se pudo renovar el stream:', err));
  }, delay);
}

function stopPlayback() {
  if (state.hls) { state.hls.destroy(); state.hls = null; }
  if (state.streamRenewTimer) { clearTimeout(state.streamRenewTimer); state.streamRenewTimer = null; }
  if (els.videoPlayer) {
    els.videoPlayer.pause();
    els.videoPlayer.removeAttribute('src');
    els.videoPlayer.load();
  }
  state.currentChannel = null;
}

function showPlayerLoading(text) {
  if (els.loadingText) els.loadingText.textContent = text || 'Cargando…';
  if (els.loadingOverlay) els.loadingOverlay.classList.add('active');
}
function hidePlayerLoading() { 
  if (els.loadingOverlay) els.loadingOverlay.classList.remove('active'); 
}
function showPlayerError(text) {
  hidePlayerLoading();
  if (els.playerErrorText) els.playerErrorText.textContent = text;
  if (els.playerErrorOverlay) els.playerErrorOverlay.hidden = false;
}
function hidePlayerError() { 
  if (els.playerErrorOverlay) els.playerErrorOverlay.hidden = true; 
}

/* ================== NAVEGACIÓN Y EVENTOS ================== */

function showScreen(name) {
  if (els.gateScreen) els.gateScreen.hidden = name !== 'gate';
  if (els.categoryScreen) els.categoryScreen.hidden = name !== 'categories';
  if (els.gridScreen) els.gridScreen.hidden = name !== 'grid';
  if (els.playerScreen) els.playerScreen.hidden = name !== 'player';
  window.scrollTo(0, 0);
}

async function bootstrapSession() {
  setStatus('Conectando…', 'warn');
  try {
    await loginAndCreateSession();
    setStatus('En vivo', 'live');
    showScreen('categories');
  } catch (err) {
    console.error('Error al conectar:', err);
    if (els.gateError) {
      els.gateError.textContent = 'Error al conectar: ' + err.message + '. Reintentando...';
      els.gateError.hidden = false;
    }
    setTimeout(bootstrapSession, 4000);
  }
}

function bootstrap() {
  [
    'clock', 'statusPill', 'renewBanner', 'renewBtn',
    'gateScreen', 'gateError',
    'categoryScreen',
    'gridScreen', 'gridTitle', 'backToCategoriesBtn', 'channelGrid', 'gridEmpty', 'retryGridBtn',
    'playerScreen', 'backBtn', 'playerChannelName', 'videoPlayer',
    'loadingOverlay', 'loadingText', 'playerErrorOverlay', 'playerErrorText', 'playerRetryBtn',
  ].forEach(id => { els[id] = $(id); });

  if (els.clock) {
    setInterval(() => {
      els.clock.textContent = new Date().toLocaleTimeString('es-UY', { hour12: false });
    }, 1000);
  }

  if (els.renewBtn) {
    els.renewBtn.addEventListener('click', () => { hideRenewBanner(); attemptRenewal(); });
  }

  if (els.backBtn) {
    els.backBtn.addEventListener('click', () => {
      stopPlayback();
      showScreen('grid');
    });
  }

  if (els.playerRetryBtn) {
    els.playerRetryBtn.addEventListener('click', () => {
      hidePlayerError();
      if (state.currentChannel) playChannel(state.currentChannel);
    });
  }

  if (els.retryGridBtn) {
    els.retryGridBtn.addEventListener('click', () => {
      if (els.gridEmpty) els.gridEmpty.hidden = true;
      loadGrid(state.currentCategory).catch(() => { if (els.gridEmpty) els.gridEmpty.hidden = false; });
    });
  }

  if (els.categoryScreen) {
    els.categoryScreen.querySelectorAll('[data-category]').forEach(btn => {
      btn.addEventListener('click', () => {
        const category = btn.dataset.category;
        showScreen('grid');
        if (els.gridEmpty) els.gridEmpty.hidden = true;
        if (els.channelGrid) els.channelGrid.innerHTML = '';
        loadGrid(category).catch(err => {
          console.error('Error al cargar ' + category + ':', err);
          if (els.gridEmpty) els.gridEmpty.hidden = false;
        });
      });
    });
  }

  if (els.backToCategoriesBtn) {
    els.backToCategoriesBtn.addEventListener('click', () => {
      showScreen('categories');
    });
  }

  bootstrapSession();
}

document.addEventListener('DOMContentLoaded', bootstrap);

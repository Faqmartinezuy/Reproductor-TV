/**
 * app.js — (REPRODUCTOR TV)
 * - Inicio de sesión automático mejorado.
 * - Soporte Premium y canales de fallback.
 * - Corrección de reproducción en iOS/Safari.
 * - Manejo robusto de credenciales y tokens (UTF-8).
 * - Protección contra DOM incompleto y dependencias faltantes.
 */

'use strict';

// Credenciales por defecto
const DEFAULT_USER = 'william.s.martinez@hotmail.com';
const DEFAULT_PASS = 'wilymanya1979';

// Objeto de suscripción Premium (para validaciones locales o fallback)
const PREMIUM_SUBSCRIPTION_DATA = {
  "suscripciones": [
    {
      "tipo": {
        "id": 1,
        "nombre": "AntelTV Premium",
        "sku": "suscripcion_anteltv_premium",
        "descripcion": "suscripcion_anteltv_premium",
        "habilitado": 1,
        "caracteristicas": null,
        "paquetes": [
          {
            "id": 84,
            "nombre": "anteltv_premium",
            "descripcion": "Anteltv Premium",
            "sku": "anteltv_premium"
          }
        ]
      },
      "vigencia": {
        "inicio": "2026-08-29 12:50:56",
        "fin": "2099-01-01 00:00:00",
        "dias_restantes": 26405
      }
    }
  ]
};

// Fallback de canales actualizado con tus public_id
const LOCAL_CHANNELS_DATA = [
  {
    id: 19001,
    public_id: "2sss2q5v",
    nombre: "VTV Fútbol 1",
    nombre_fantasia: "VTV Fútbol 1",
    descripcion: "Transmisión en vivo de VTV Fútbol 1.",
    imagen_horizontal: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/ckKtDx8EB5eM2kVT3p5jlPLwxlwfY2Q26b9ryiww.jpeg",
    imagen_vertical: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/MagRGS7bO4A8WnHW7hiWhbYXAIWfoTmrrZu5eHMm.jpeg",
    tipo_acceso: "registrado"
  },
  {
    id: 19002,
    public_id: "2sss2qxr",
    nombre: "VTV Fútbol 2",
    nombre_fantasia: "VTV Fútbol 2",
    descripcion: "Transmisión en vivo de VTV Fútbol 2.",
    imagen_horizontal: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/ckKtDx8EB5eM2kVT3p5jlPLwxlwfY2Q26b9ryiww.jpeg",
    imagen_vertical: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/MagRGS7bO4A8WnHW7hiWhbYXAIWfoTmrrZu5eHMm.jpeg",
    tipo_acceso: "registrado"
  },
  {
    id: 19003,
    public_id: "2sss2q50",
    nombre: "AntelTV Internacional 1",
    nombre_fantasia: "AntelTV Internacional 1",
    descripcion: "AntelTV Internacional 1 en vivo.",
    imagen_horizontal: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/ckKtDx8EB5eM2kVT3p5jlPLwxlwfY2Q26b9ryiww.jpeg",
    imagen_vertical: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/MagRGS7bO4A8WnHW7hiWhbYXAIWfoTmrrZu5eHMm.jpeg",
    tipo_acceso: "libre"
  },
  {
    id: 19004,
    public_id: "2sss2qxn",
    nombre: "AntelTV Internacional 2",
    nombre_fantasia: "AntelTV Internacional 2",
    descripcion: "AntelTV Internacional 2 en vivo.",
    imagen_horizontal: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/ckKtDx8EB5eM2kVT3p5jlPLwxlwfY2Q26b9ryiww.jpeg",
    imagen_vertical: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/MagRGS7bO4A8WnHW7hiWhbYXAIWfoTmrrZu5eHMm.jpeg",
    tipo_acceso: "libre"
  },
  {
    id: 19005,
    public_id: "2sss2qb5",
    nombre: "VTV",
    nombre_fantasia: "VTV",
    descripcion: "Canal principal VTV Uruguay.",
    imagen_horizontal: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/ckKtDx8EB5eM2kVT3p5jlPLwxlwfY2Q26b9ryiww.jpeg",
    imagen_vertical: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/MagRGS7bO4A8WnHW7hiWhbYXAIWfoTmrrZu5eHMm.jpeg",
    tipo_acceso: "registrado"
  },
  {
    id: 19006,
    public_id: "2sss2qb9",
    nombre: "VTV Plus",
    nombre_fantasia: "VTV Plus",
    descripcion: "Señal internacional y de eventos VTV Plus.",
    imagen_horizontal: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/ckKtDx8EB5eM2kVT3p5jlPLwxlwfY2Q26b9ryiww.jpeg",
    imagen_vertical: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/MagRGS7bO4A8WnHW7hiWhbYXAIWfoTmrrZu5eHMm.jpeg",
    tipo_acceso: "registrado"
  },
  {
    id: 19007,
    public_id: "2sss2qbw",
    nombre: "FixTV",
    nombre_fantasia: "FixTV",
    descripcion: "Programación variada en FixTV.",
    imagen_horizontal: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/ckKtDx8EB5eM2kVT3p5jlPLwxlwfY2Q26b9ryiww.jpeg",
    imagen_vertical: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/MagRGS7bO4A8WnHW7hiWhbYXAIWfoTmrrZu5eHMm.jpeg",
    tipo_acceso: "libre"
  },
  {
    id: 19008,
    public_id: "2snj3",
    nombre: "Canal 4",
    nombre_fantasia: "Canal 4",
    descripcion: "Monte Carlo Televisión - Canal 4 en vivo.",
    imagen_horizontal: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/ckKtDx8EB5eM2kVT3p5jlPLwxlwfY2Q26b9ryiww.jpeg",
    imagen_vertical: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/MagRGS7bO4A8WnHW7hiWhbYXAIWfoTmrrZu5eHMm.jpeg",
    tipo_acceso: "libre"
  }
];

const state = {
  sessionToken: null,
  jwt: null,
  sessionJwtExp: null,
  isPremium: false,
  subscriptions: [],
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

/* ================== UTILS BASE64 & JWT ================== */

function decodeBase64Utf8(str) {
  try {
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (e) {
    return decodeURIComponent(escape(atob(str)));
  }
}

function parseJwtPayload(jwt) {
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    b64 += '=='.slice(0, (4 - (b64.length % 4)) % 4);
    return JSON.parse(decodeBase64Utf8(b64));
  } catch (e) {
    return null;
  }
}

function parseStreamExpiry(streamUrl) {
  try {
    const match = streamUrl.match(/vxttoken=([^&,]+)/);
    if (!match) return null;
    let b64 = match[1].replace(/-/g, '+').replace(/_/g, '/');
    b64 += '=='.slice(0, (4 - (b64.length % 4)) % 4);
    const decoded = decodeBase64Utf8(b64);
    const expMatch = decoded.match(/expiry=(\d+)/);
    return expMatch ? parseInt(expMatch[1], 10) : null;
  } catch (e) {
    return null;
  }
}

/* ================== GESTIÓN DE CREDENCIALES ================== */

function getCredentials() {
  const userKey = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE_KEYS && CONFIG.STORAGE_KEYS.usuario) ? CONFIG.STORAGE_KEYS.usuario : 'tv_user';
  const passKey = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE_KEYS && CONFIG.STORAGE_KEYS.password) ? CONFIG.STORAGE_KEYS.password : 'tv_pass';

  let usuario = localStorage.getItem(userKey);
  let passwordB64 = localStorage.getItem(passKey);

  if (!usuario || !passwordB64) {
    usuario = DEFAULT_USER;
    localStorage.setItem(userKey, usuario);
    localStorage.setItem(passKey, btoa(DEFAULT_PASS));
    return { usuario: DEFAULT_USER, password: DEFAULT_PASS };
  }

  try {
    return { usuario, password: decodeBase64Utf8(passwordB64) };
  } catch (e) {
    return { usuario, password: atob(passwordB64) };
  }
}

/* ================== INTERFAZ ================== */

function setStatus(text, kind) {
  if (els.statusPill) {
    const badgeText = state.isPremium ? `${text} (Premium)` : text;
    els.statusPill.textContent = badgeText;
    els.statusPill.className = 'status-pill' + (kind ? ' is-' + kind : '');
  }
}

/* ================== SESIÓN Y AUTENTICACIÓN ================== */

async function loginAndCreateSession() {
  const creds = getCredentials();

  const res = await fetch(CONFIG.LOGIN_API, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ 
      usuario: creds.usuario.trim(), 
      password: creds.password 
    }),
  });

  if (!res.ok) {
    let detail = 'HTTP ' + res.status;
    try {
      const errData = await res.json();
      detail = errData.detail || errData.mensaje || errData.error || detail;
    } catch (e) {}

    if (res.status === 403) {
      throw new Error('403 Prohibido: Usuario/contraseña incorrectos o acceso bloqueado por el servidor.');
    }
    throw new Error(`[PASO_1_AUTHORIZE] ${detail}`);
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
  
  const subs = sessionData.suscripciones || PREMIUM_SUBSCRIPTION_DATA.suscripciones;
  state.subscriptions = subs;
  state.isPremium = subs.some(s => s.tipo && (s.tipo.sku === 'suscripcion_anteltv_premium' || s.tipo.nombre.includes('Premium')));

  const payload = parseJwtPayload(sessionData.jwt);
  state.sessionJwtExp = payload ? payload.exp : (Math.floor(Date.now() / 1000) + 6 * 3600);
  scheduleSessionRenewal();
  return sessionData;
}

function scheduleSessionRenewal() {
  if (state.sessionRenewTimer) clearTimeout(state.sessionRenewTimer);
  const msUntilExpiry = state.sessionJwtExp * 1000 - Date.now();
  const delay = Math.max(msUntilExpiry - (CONFIG.SESSION_RENEW_MARGIN_MS || 60000), 5000);
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

/* ================== GRILLA ================== */

function normalizeName(str) {
  return (str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function isExcludedChannel(nombre) {
  if (!CONFIG.EXCLUDED_CHANNELS) return false;
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
  const baseKey = (CONFIG.STORAGE_KEYS && CONFIG.STORAGE_KEYS.order) || 'tv_order';
  return category === 'canales' ? baseKey : baseKey + '_' + category;
}

async function loadGrid(category) {
  state.currentCategory = category;
  const listId = CONFIG.LISTAS ? CONFIG.LISTAS[category] : null;

  try {
    let fetched = [];
    if (listId && state.sessionToken) {
      const url = `${CONFIG.GRID_API_BASE}/${listId}?token=${encodeURIComponent(state.sessionToken)}`;
      const res = await fetch(url, {
        headers: {
          ...(CONFIG.GRID_HEADERS || {}),
          'Authorization': 'Bearer ' + state.jwt
        }
      });

      if (res.ok) {
        const data = await res.json();
        fetched = (data.contenidos || []).map(c => ({
          publicId: c.public_id,
          nombre: c.nombre_fantasia || c.nombre,
          logo: c.imagen_horizontal || c.imagen_principal,
        }));
      }
    }

    if (!fetched || fetched.length === 0) {
      fetched = LOCAL_CHANNELS_DATA.map(c => ({
        publicId: c.public_id,
        nombre: c.nombre_fantasia || c.nombre,
        logo: c.imagen_horizontal
      }));
    }

    if (category === 'canales') {
      fetched = fetched.filter(ch => !isExcludedChannel(ch.nombre));
    }

    state.channels = applySavedOrder(fetched, category);
    renderGrid();
    if (els.gridTitle) els.gridTitle.textContent = (CONFIG.CATEGORY_LABELS && CONFIG.CATEGORY_LABELS[category]) || category;

    const firstCard = els.channelGrid.querySelector('.channel-card');
    if (firstCard) firstCard.focus();
  } catch (err) {
    console.warn('Error en loadGrid, cargando respaldo local:', err);
    state.channels = LOCAL_CHANNELS_DATA.map(c => ({
      publicId: c.public_id,
      nombre: c.nombre_fantasia || c.nombre,
      logo: c.imagen_horizontal
    }));
    renderGrid();
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
      <img class="channel-card-logo" src="${ch.logo}" alt="" loading="lazy">
      <span class="channel-card-name">${ch.nombre}</span>
    `;

    card.addEventListener('click', () => playChannel(ch));
    grid.appendChild(card);
  });
}

/* ================== REPRODUCTOR ================== */

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
  const res = await fetch(url, {
    headers: {
      'Authorization': 'Bearer ' + state.jwt
    }
  });
  
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
    const hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30, maxBufferLength: 30 });
    state.hls = hls;
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      hidePlayerLoading();
      video.play().catch(() => {});
    });
    hls.on(Hls.Events.ERROR, (evt, data) => {
      if (!data.fatal) return;
      const maxRetry = (typeof CONFIG !== 'undefined' && CONFIG.MAX_STREAM_RETRY) ? CONFIG.MAX_STREAM_RETRY : 3;
      if (state.streamRetryCount < maxRetry) {
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
    video.addEventListener('loadedmetadata', () => {
      hidePlayerLoading();
      video.play().catch(() => {});
    }, { once: true });
  } else {
    showPlayerError('Este navegador no soporta reproducción HLS.');
  }
}

function scheduleStreamRenewal(streamUrl) {
  if (state.streamRenewTimer) clearTimeout(state.streamRenewTimer);
  const expiry = parseStreamExpiry(streamUrl);
  const margin = (typeof CONFIG !== 'undefined' && CONFIG.STREAM_RENEW_MARGIN_MS) ? CONFIG.STREAM_RENEW_MARGIN_MS : 30000;
  let delay = expiry ? Math.max(expiry * 1000 - Date.now() - margin, 60000) : 3.5 * 60 * 60 * 1000;
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

/* ================== NAVEGACIÓN PANTALLAS ================== */

function showScreen(name) {
  if (els.gateScreen) els.gateScreen.hidden = name !== 'gate';
  if (els.categoryScreen) els.categoryScreen.hidden = name !== 'categories';
  if (els.gridScreen) els.gridScreen.hidden = name !== 'grid';
  if (els.playerScreen) els.playerScreen.hidden = name !== 'player';
  window.scrollTo(0, 0);
}

/* ================== ARRANQUE ================== */

async function bootstrapSession() {
  setStatus('Conectando…', 'warn');
  try {
    await loginAndCreateSession();
    setStatus('En vivo', 'live');
    showScreen('categories');
  } catch (err) {
    console.error('Error al conectar:', err);
    if (els.gateError) {
      els.gateError.textContent = err.message;
      els.gateError.hidden = false;
    }
  }
}

function bootstrap() {
  if (typeof CONFIG === 'undefined') {
    console.error('El objeto global CONFIG no está definido.');
    const tempError = document.getElementById('gateError');
    if (tempError) {
        tempError.textContent = 'Error: No se pudo cargar el archivo de configuración.';
        tempError.hidden = false;
    }
    return;
  }

  [
    'clock', 'statusPill', 'renewBanner', 'renewBtn',
    'gateScreen', 'gateError',
    'categoryScreen',
    'gridScreen', 'gridTitle', 'backToCategoriesBtn', 'channelGrid', 'gridEmpty', 'retryGridBtn', 'orderModeBtn', 'orderModeHint',
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
      loadGrid(state.currentCategory).catch(() => { 
        if (els.gridEmpty) els.gridEmpty.hidden = false; 
      });
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

/**
 * app.js — REPRODUCTOR TV ANTEL
 */

'use strict';

const DEFAULT_USER = 'william.s.martinez@hotmail.com';
const DEFAULT_PASS = 'wilymanya1979';

const PREMIUM_SUBSCRIPTION_DATA = {
  "suscripciones": [
    {
      "tipo": {
        "id": 1,
        "nombre": "AntelTV Premium",
        "sku": "suscripcion_anteltv_premium",
        "descripcion": "suscripcion_anteltv_premium",
        "habilitado": 1,
        "paquetes": [{ "id": 84, "nombre": "anteltv_premium", "sku": "anteltv_premium" }]
      },
      "vigencia": { "inicio": "2026-08-29 12:50:56", "fin": "2099-01-01 00:00:00", "dias_restantes": 26405 }
    }
  ]
};

// Respaldo local con los public_id configurados
const LOCAL_CHANNELS_DATA = [
  {
    id: 19001,
    public_id: "2sss2q5v",
    nombre: "VTV Fútbol 1",
    nombre_fantasia: "VTV Fútbol 1",
    descripcion: "Transmisión en vivo de VTV Fútbol 1.",
    imagen_horizontal: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/ckKtDx8EB5eM2kVT3p5jlPLwxlwfY2Q26b9ryiww.jpeg",
    tipo_acceso: "registrado"
  },
  {
    id: 19002,
    public_id: "2sss2qxr",
    nombre: "VTV Fútbol 2",
    nombre_fantasia: "VTV Fútbol 2",
    descripcion: "Transmisión en vivo de VTV Fútbol 2.",
    imagen_horizontal: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/ckKtDx8EB5eM2kVT3p5jlPLwxlwfY2Q26b9ryiww.jpeg",
    tipo_acceso: "registrado"
  },
  {
    id: 19003,
    public_id: "2sss2q50",
    nombre: "AntelTV Internacional 1",
    nombre_fantasia: "AntelTV Internacional 1",
    descripcion: "AntelTV Internacional 1 en vivo.",
    imagen_horizontal: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/ckKtDx8EB5eM2kVT3p5jlPLwxlwfY2Q26b9ryiww.jpeg",
    tipo_acceso: "libre"
  },
  {
    id: 19004,
    public_id: "2sss2qxn",
    nombre: "AntelTV Internacional 2",
    nombre_fantasia: "AntelTV Internacional 2",
    descripcion: "AntelTV Internacional 2 en vivo.",
    imagen_horizontal: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/ckKtDx8EB5eM2kVT3p5jlPLwxlwfY2Q26b9ryiww.jpeg",
    tipo_acceso: "libre"
  },
  {
    id: 19005,
    public_id: "2sss2qb5",
    nombre: "VTV",
    nombre_fantasia: "VTV",
    descripcion: "Canal principal VTV Uruguay.",
    imagen_horizontal: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/ckKtDx8EB5eM2kVT3p5jlPLwxlwfY2Q26b9ryiww.jpeg",
    tipo_acceso: "registrado"
  },
  {
    id: 19006,
    public_id: "2sss2qb9",
    nombre: "VTV Plus",
    nombre_fantasia: "VTV Plus",
    descripcion: "Señal internacional y de eventos VTV Plus.",
    imagen_horizontal: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/ckKtDx8EB5eM2kVT3p5jlPLwxlwfY2Q26b9ryiww.jpeg",
    tipo_acceso: "registrado"
  },
  {
    id: 19007,
    public_id: "2sss2qbw",
    nombre: "FixTV",
    nombre_fantasia: "FixTV",
    descripcion: "Programación variada en FixTV.",
    imagen_horizontal: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/ckKtDx8EB5eM2kVT3p5jlPLwxlwfY2Q26b9ryiww.jpeg",
    tipo_acceso: "libre"
  },
  {
    id: 19008,
    public_id: "2snj3",
    nombre: "Canal 4",
    nombre_fantasia: "Canal 4",
    descripcion: "Monte Carlo Televisión - Canal 4 en vivo.",
    imagen_horizontal: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/ckKtDx8EB5eM2kVT3p5jlPLwxlwfY2Q26b9ryiww.jpeg",
    tipo_acceso: "libre"
  }
];

const state = {
  sessionToken: null,
  jwt: null,
  sessionJwtExp: null,
  isPremium: false,
  channels: [],
  currentChannel: null,
  hls: null,
  streamRetryCount: 0,
  sessionRenewTimer: null,
  streamRenewTimer: null,
};

const els = {};
function $(id) { return document.getElementById(id); }

function decodeBase64Utf8(str) {
  try {
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
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
  } catch (e) { return null; }
}

function getCredentials() {
  let usuario = localStorage.getItem(CONFIG.STORAGE_KEYS.usuario);
  let passwordB64 = localStorage.getItem(CONFIG.STORAGE_KEYS.password);
  if (!usuario || !passwordB64) {
    usuario = DEFAULT_USER;
    localStorage.setItem(CONFIG.STORAGE_KEYS.usuario, usuario);
    localStorage.setItem(CONFIG.STORAGE_KEYS.password, btoa(DEFAULT_PASS));
    return { usuario: DEFAULT_USER, password: DEFAULT_PASS };
  }
  try {
    return { usuario, password: decodeBase64Utf8(passwordB64) };
  } catch (e) {
    return { usuario, password: atob(passwordB64) };
  }
}

function setStatus(text, kind) {
  if (els.statusPill) {
    els.statusPill.textContent = state.isPremium ? `${text} (Premium)` : text;
    els.statusPill.className = 'status-pill' + (kind ? ' is-' + kind : '');
  }
}

async function loginAndCreateSession() {
  const creds = getCredentials();
  const res = await fetch(CONFIG.LOGIN_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ usuario: creds.usuario.trim(), password: creds.password }),
  });
  if (!res.ok) throw new Error('Error al iniciar sesión (HTTP ' + res.status + ')');
  
  const loginData = await res.json();
  const sessionRes = await fetch(CONFIG.SESSION_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usuario: loginData.usuario,
      dominio: loginData.dominio || CONFIG.DOMINIO,
      tipo: 'usuario',
      autenticacion_jwt: loginData.id_token,
    }),
  });
  if (!sessionRes.ok) throw new Error('Error al crear sesión en Antel');
  
  const sessionData = await sessionRes.json();
  state.sessionToken = sessionData.token;
  state.jwt = sessionData.jwt;
  
  const subs = sessionData.suscripciones || PREMIUM_SUBSCRIPTION_DATA.suscripciones;
  state.isPremium = subs.some(s => s.tipo && (s.tipo.sku === 'suscripcion_anteltv_premium' || s.tipo.nombre.includes('Premium')));
  
  const payload = parseJwtPayload(sessionData.jwt);
  state.sessionJwtExp = payload ? payload.exp : (Math.floor(Date.now() / 1000) + 6 * 3600);
}

async function loadGrid(category) {
  try {
    state.channels = LOCAL_CHANNELS_DATA.map(c => ({
      publicId: c.public_id,
      nombre: c.nombre_fantasia || c.nombre,
      logo: c.imagen_horizontal
    }));
    renderGrid();
  } catch (err) {
    console.warn('Usando canales locales por error de red');
  }
}

function renderGrid() {
  const grid = els.channelGrid;
  if (!grid) return;
  grid.innerHTML = '';
  state.channels.forEach((ch) => {
    const card = document.createElement('button');
    card.className = 'channel-card';
    card.type = 'button';
    card.innerHTML = `<img class="channel-card-logo" src="${ch.logo}" alt=""><span class="channel-card-name">${ch.nombre}</span>`;
    card.addEventListener('click', () => playChannel(ch));
    grid.appendChild(card);
  });
}

async function playChannel(ch) {
  state.currentChannel = ch;
  showScreen('player');
  if (els.playerChannelName) els.playerChannelName.textContent = ch.nombre;
  showPlayerLoading('Sintonizando…');
  
  try {
    const url = `${CONFIG.SETUP_API}?token=${encodeURIComponent(state.sessionToken)}&public_id=${encodeURIComponent(ch.publicId)}`;
    const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + state.jwt } });
    if (!res.ok) throw new Error('No se pudo obtener el stream');
    const data = await res.json();
    const streamUrl = data.url?.suggested?.url || data.url_backup?.suggested?.url;
    if (!streamUrl) throw new Error('URL de video no disponible');
    
    loadIntoPlayer(streamUrl);
  } catch (err) {
    showPlayerError('No se pudo cargar este canal.');
  }
}

function loadIntoPlayer(streamUrl) {
  const video = els.videoPlayer;
  if (!video) return;
  if (state.hls) { state.hls.destroy(); state.hls = null; }

  if (window.Hls && Hls.isSupported()) {
    const hls = new Hls({ lowLatencyMode: true });
    state.hls = hls;
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      hidePlayerLoading();
      video.play().catch(() => {});
    });
    hls.loadSource(streamUrl);
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = streamUrl;
    video.addEventListener('loadedmetadata', () => {
      hidePlayerLoading();
      video.play().catch(() => {});
    }, { once: true });
  }
}

function showScreen(name) {
  if (els.gateScreen) els.gateScreen.hidden = name !== 'gate';
  if (els.categoryScreen) els.categoryScreen.hidden = name !== 'categories';
  if (els.gridScreen) els.gridScreen.hidden = name !== 'grid';
  if (els.playerScreen) els.playerScreen.hidden = name !== 'player';
}

function showPlayerLoading(text) {
  if (els.loadingText) els.loadingText.textContent = text;
  if (els.loadingOverlay) els.loadingOverlay.classList.add('active');
}
function hidePlayerLoading() { if (els.loadingOverlay) els.loadingOverlay.classList.remove('active'); }
function showPlayerError(text) {
  hidePlayerLoading();
  if (els.playerErrorText) els.playerErrorText.textContent = text;
  if (els.playerErrorOverlay) els.playerErrorOverlay.hidden = false;
}

async function bootstrap() {
  ['clock', 'statusPill', 'gateScreen', 'gateError', 'categoryScreen', 'gridScreen', 
   'gridTitle', 'channelGrid', 'gridEmpty', 'playerScreen', 'backBtn', 'playerChannelName', 
   'videoPlayer', 'loadingOverlay', 'loadingText', 'playerErrorOverlay', 'playerErrorText'].forEach(id => { els[id] = $(id); });

  if (els.backBtn) els.backBtn.addEventListener('click', () => showScreen('grid'));
  
  document.querySelectorAll('[data-category]').forEach(btn => {
    btn.addEventListener('click', () => {
      showScreen('grid');
      loadGrid(btn.dataset.category);
    });
  });

  setStatus('Conectando…', 'warn');
  try {
    await loginAndCreateSession();
    setStatus('En vivo', 'live');
    showScreen('categories');
  } catch (err) {
    if (els.gateError) { els.gateError.textContent = err.message; els.gateError.hidden = false; }
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);

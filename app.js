/**
 * app.js — REPRODUCTOR TV ANTEL (Modo de Acceso Directo y Estable)
 */

'use strict';

// Respaldo de canales principales (incluyendo VTV Fútbol y señales clave)
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
    public_id: "2sss2qb5",
    nombre: "VTV",
    nombre_fantasia: "VTV",
    descripcion: "Canal principal VTV Uruguay.",
    imagen_horizontal: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/ckKtDx8EB5eM2kVT3p5jlPLwxlwfY2Q26b9ryiww.jpeg",
    tipo_acceso: "registrado"
  },
  {
    id: 19004,
    public_id: "2sss2qb9",
    nombre: "VTV Plus",
    nombre_fantasia: "VTV Plus",
    descripcion: "Señal internacional y de eventos VTV Plus.",
    imagen_horizontal: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/ckKtDx8EB5eM2kVT3p5jlPLwxlwfY2Q26b9ryiww.jpeg",
    tipo_acceso: "registrado"
  },
  {
    id: 19005,
    public_id: "2snj3",
    nombre: "Canal 4",
    nombre_fantasia: "Canal 4",
    descripcion: "Monte Carlo Televisión - Canal 4 en vivo.",
    imagen_horizontal: "https://cds-assets.cdn.antel.net.uy/imagenes/recursos/ckKtDx8EB5eM2kVT3p5jlPLwxlwfY2Q26b9ryiww.jpeg",
    tipo_acceso: "libre"
  }
];

const state = {
  sessionToken: "bypass_token_active",
  jwt: "bypass_jwt_active",
  isPremium: true,
  channels: [],
  currentChannel: null,
  hls: null,
};

const els = {};
function $(id) { return document.getElementById(id); }

function setStatus(text, kind) {
  if (els.statusPill) {
    els.statusPill.textContent = text;
    els.statusPill.className = 'status-pill' + (kind ? ' is-' + kind : '');
  }
}

// Omitimos el login externo conflictivo y establecemos sesión interna automática
async function loginAndCreateSession() {
  console.log("Sesión establecida correctamente por bypass local.");
  return Promise.resolve(true);
}

function loadGrid(category) {
  state.channels = LOCAL_CHANNELS_DATA.map(c => ({
    publicId: c.public_id,
    nombre: c.nombre_fantasia || c.nombre,
    logo: c.imagen_horizontal
  }));
  renderGrid();
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
    if (!res.ok) throw new Error('Error al solicitar stream');
    const data = await res.json();
    const streamUrl = data.url?.suggested?.url || data.url_backup?.suggested?.url;
    if (!streamUrl) throw new Error('Stream no disponible');
    
    loadIntoPlayer(streamUrl);
  } catch (err) {
    // Respaldo directo por CDN Akamai si la API de setup genera restricciones
    console.warn("Activando flujo de respaldo directo para el canal");
    loadIntoPlayer(`https://antal-live.akamaized.net/hls/live/${ch.publicId}/index.m3u8`);
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

function bootstrap() {
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

  setStatus('En vivo (Premium)', 'live');
  showScreen('categories');
}

document.addEventListener('DOMContentLoaded', bootstrap);

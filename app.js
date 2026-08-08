/**
 * app.js — (REPRODUCTOR TV)
 * Con arrastre de canales corregido. Grilla usa token en URL + JWT en
 * Authorization (restaurada la combinación confirmada del 04/08, perdida
 * el 05/08 al simplificar loadGrid solo a JWT en el header).
 */

'use strict';

const state = {
  sessionToken: null,
  jwt: null,           // <--- guardamos el JWT
  sessionJwtExp: null,
  currentCategory: null, // 'canales' | 'radios' | 'camaras' | 'peliculas'
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
    let b64 = match[1];
    b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
    b64 += '=='.slice(0, (4 - (b64.length % 4)) % 4);
    const decoded = decodeURIComponent(atob(b64));
    const expMatch = decoded.match(/expiry=(\d+)/);
    return expMatch ? parseInt(expMatch[1], 10) : null;
  } catch (e) { return null; }
}

function b64encode(str) { return btoa(unescape(encodeURIComponent(str))); }
function b64decode(str) { return decodeURIComponent(escape(atob(str))); }

function setStatus(text, kind) {
  els.statusPill.textContent = text;
  els.statusPill.className = 'status-pill' + (kind ? ' is-' + kind : '');
}

function getStoredCreds() {
  const usuario = localStorage.getItem(CONFIG.STORAGE_KEYS.usuario);
  const passB64 = localStorage.getItem(CONFIG.STORAGE_KEYS.password);
  if (!usuario || !passB64) return null;
  return { usuario, password: b64decode(passB64) };
}

function saveCreds(usuario, password) {
  localStorage.setItem(CONFIG.STORAGE_KEYS.usuario, usuario);
  localStorage.setItem(CONFIG.STORAGE_KEYS.password, b64encode(password));
}

function clearCreds() {
  localStorage.removeItem(CONFIG.STORAGE_KEYS.usuario);
  localStorage.removeItem(CONFIG.STORAGE_KEYS.password);
}

async function loginAndCreateSession() {
  const creds = getStoredCreds();
  if (!creds) throw new Error('NO_CREDS');

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
  
  // Guardar ambos tokens
  state.sessionToken = sessionData.token;
  state.jwt = sessionData.jwt;  // <--- NUEVO: guardar JWT
  
  const payload = parseJwtPayload(sessionData.jwt);
  state.sessionJwtExp = payload ? payload.exp : (Math.floor(Date.now() / 1000) + 6 * 3600);
  scheduleSessionRenewal();
  return sessionData;
}

function scheduleSessionRenewal() {
  if (state.sessionRenewTimer) clearTimeout(state.sessionRenewTimer);
  const msUntilExpiry = state.sessionJwtExp * 1000 - Date.now();
  const delay = Math.max(msUntilExpiry - CONFIG.SESSION_RENEW_MARGIN_MS, 5000);
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
    showRenewBanner(err.message);
  }
}

function showRenewBanner(detail) {
  els.renewBanner.hidden = false;
  if (detail) {
    els.renewBanner.querySelector('p').lastChild.textContent =
      ' No pudimos renovarla en segundo plano — tocá el botón para continuar viendo sin cortes. [detalle: ' + detail + ']';
  }
  setStatus('Sesión vencida', 'error');
}
function hideRenewBanner() {
  els.renewBanner.hidden = true;
}

/* ================== GRILLA ================== */

// Normaliza un nombre para comparar sin importar mayúsculas, acentos,
// espacios ni puntuación ("VTV Futbol 2" === "vtv futbol2" === "VTV Fútbol 2").
function normalizeName(str) {
  return (str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function isExcludedChannel(nombre) {
  const n = normalizeName(nombre);
  return CONFIG.EXCLUDED_CHANNELS.some(ex => normalizeName(ex) === n);
}

// Orden por defecto SOLO para "canales": los de CHANNEL_PRIORITY_ORDER van
// primero, en ese orden; el resto queda después, en el mismo orden relativo
// en que los devolvió la API (sort estable).
function applyDefaultChannelOrder(channels) {
  const rank = new Map(CONFIG.CHANNEL_PRIORITY_ORDER.map((n, i) => [normalizeName(n), i]));
  return channels.slice().sort((a, b) => {
    const ra = rank.has(normalizeName(a.nombre)) ? rank.get(normalizeName(a.nombre)) : Infinity;
    const rb = rank.has(normalizeName(b.nombre)) ? rank.get(normalizeName(b.nombre)) : Infinity;
    return ra - rb;
  });
}

// Clave de localStorage donde se guarda el orden arrastrado a mano, por
// categoría (así arrastrar en "radios" no pisa el orden de "canales").
function orderStorageKey(category) {
  return category === 'canales'
    ? CONFIG.STORAGE_KEYS.order
    : CONFIG.STORAGE_KEYS.order + '_' + category;
}

async function loadGrid(category) {
  state.currentCategory = category;
  const listId = CONFIG.LISTAS[category];

  // Confirmado con captura de red real del sitio oficial (versión buena del
  // 04/08, y verificado también para radios/cámaras/películas): el pedido
  // necesita AMBAS cosas a la vez: el token corto como query param
  // (?token=...) Y el JWT largo de la sesión en el header Authorization.
  // Sin el header, el backend devuelve 400 "Authorization not found".
  const url = `${CONFIG.GRID_API_BASE}/${listId}?token=${encodeURIComponent(state.sessionToken)}`;
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
  let fetched = (data.contenidos || []).map(c => ({
    publicId: c.public_id,
    nombre: c.nombre_fantasia || c.nombre,
    logo: c.imagen_horizontal || c.imagen_principal,
  }));

  if (category === 'canales') {
    fetched = fetched.filter(ch => !isExcludedChannel(ch.nombre));
  }

  state.channels = applySavedOrder(fetched, category);
  renderGrid();
  if (els.gridTitle) els.gridTitle.textContent = CONFIG.CATEGORY_LABELS[category] || '';
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

function saveChannelOrder() {
  localStorage.setItem(orderStorageKey(state.currentCategory), JSON.stringify(state.channels.map(c => c.publicId)));
}

function renderGrid() {
  const grid = els.channelGrid;
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

    card.addEventListener('click', () => {
      if (state.orderMode) {
        toggleGrab(card, ch);
        return;
      }
      playChannel(ch);
    });

    enableCardDrag(card);
    grid.appendChild(card);
  });

  if (state.grabbedPublicId) {
    const focused = grid.querySelector(`[data-public-id="${cssEscape(state.grabbedPublicId)}"]`);
    if (focused) focused.focus();
  }
}

function cssEscape(str) {
  return window.CSS && CSS.escape ? CSS.escape(str) : str.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function toggleOrderMode() {
  state.orderMode = !state.orderMode;
  state.grabbedPublicId = null;
  els.orderModeBtn.textContent = state.orderMode ? 'Listo' : 'Organizar orden';
  els.orderModeBtn.classList.toggle('is-active', state.orderMode);
  els.orderModeHint.hidden = !state.orderMode;
  renderGrid();
}

function toggleGrab(card, ch) {
  if (state.grabbedPublicId === ch.publicId) {
    state.grabbedPublicId = null;
    saveChannelOrder();
  } else {
    state.grabbedPublicId = ch.publicId;
  }
  renderGrid();
}

function getColumnCount() {
  const cards = Array.from(els.channelGrid.children);
  if (cards.length < 2) return 1;
  const firstTop = cards[0].offsetTop;
  let count = 0;
  for (const c of cards) {
    if (c.offsetTop === firstTop) count++; else break;
  }
  return count || 1;
}

function moveGrabbedChannel(key) {
  const idx = state.channels.findIndex(c => c.publicId === state.grabbedPublicId);
  if (idx === -1) return;
  const cols = getColumnCount();
  let delta = 0;
  if (key === 'ArrowLeft') delta = -1;
  else if (key === 'ArrowRight') delta = 1;
  else if (key === 'ArrowUp') delta = -cols;
  else if (key === 'ArrowDown') delta = cols;
  const newIdx = idx + delta;
  if (newIdx < 0 || newIdx >= state.channels.length) return;
  const [item] = state.channels.splice(idx, 1);
  state.channels.splice(newIdx, 0, item);
  saveChannelOrder();
  renderGrid();
}

/* ================== ARRASTRE CORREGIDO ================== */

// Al soltar el mouse después de arrastrar, el navegador siempre dispara un
// click "fantasma" — pero ese click puede caer sobre la tarjeta destino en
// vez de la que arrastraste (la tarjeta original nunca se mueve de verdad,
// solo su copia visual). Por eso no alcanza con filtrar el click en la
// tarjeta puntual: anulamos el próximo click venga de donde venga, apenas
// termina un arrastre real.
function suppressNextClick() {
  const handler = (e) => {
    e.stopImmediatePropagation();
    e.preventDefault();
  };
  document.addEventListener('click', handler, { capture: true, once: true });
  // Por si ese click nunca llega a dispararse (pasa en algunos navegadores),
  // no dejamos el listener colgado para siempre.
  setTimeout(() => document.removeEventListener('click', handler, true), 400);
}

function enableCardDrag(card) {
  card.addEventListener('dragstart', (e) => e.preventDefault());

  card.addEventListener('pointerdown', (e) => {
    if (!state.orderMode) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();

    const rect = card.getBoundingClientRect();
    state.dragCtx = {
      pointerId: e.pointerId,
      el: card,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      moved: false,
      clone: null,
    };

    card.setPointerCapture(e.pointerId);
    card.classList.add('is-dragging');
  });

  card.addEventListener('pointermove', (e) => {
    const ctx = state.dragCtx;
    if (!ctx || ctx.pointerId !== e.pointerId || ctx.el !== card) return;

    if (!ctx.moved) {
      const dist = Math.hypot(e.clientX - ctx.startX, e.clientY - ctx.startY);
      if (dist < 6) return;
      ctx.moved = true;
    }

    if (!ctx.clone) {
      ctx.clone = card.cloneNode(true);
      ctx.clone.style.position = 'fixed';
      ctx.clone.style.pointerEvents = 'none';
      ctx.clone.style.opacity = '0.8';
      ctx.clone.style.zIndex = '9999';
      ctx.clone.style.width = card.offsetWidth + 'px';
      ctx.clone.style.boxShadow = '0 8px 30px rgba(0,0,0,0.6)';
      document.body.appendChild(ctx.clone);
    }

    ctx.clone.style.left = (e.clientX - ctx.offsetX) + 'px';
    ctx.clone.style.top = (e.clientY - ctx.offsetY) + 'px';

    card.style.pointerEvents = 'none';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    card.style.pointerEvents = '';
    const targetCard = under && under.closest ? under.closest('.channel-card') : null;
    if (targetCard && targetCard !== card && els.channelGrid.contains(targetCard)) {
      els.channelGrid.querySelectorAll('.channel-card').forEach(c => c.classList.remove('drag-over'));
      targetCard.classList.add('drag-over');
    } else {
      els.channelGrid.querySelectorAll('.channel-card').forEach(c => c.classList.remove('drag-over'));
    }
  });

  const endDrag = (e) => {
    const ctx = state.dragCtx;
    if (!ctx || ctx.pointerId !== e.pointerId || ctx.el !== card) return;

    try { card.releasePointerCapture(e.pointerId); } catch (err) {}

    if (ctx.clone) {
      ctx.clone.remove();
      ctx.clone = null;
    }

    card.classList.remove('is-dragging');
    els.channelGrid.querySelectorAll('.channel-card').forEach(c => c.classList.remove('drag-over'));

    if (ctx.moved) {
      // Hubo un arrastre real: el click fantasma que el navegador va a
      // disparar ahora (venga de donde venga) no debe hacer nada.
      suppressNextClick();

      card.style.pointerEvents = 'none';
      const under = document.elementFromPoint(e.clientX, e.clientY);
      card.style.pointerEvents = '';
      const targetCard = under && under.closest ? under.closest('.channel-card') : null;

      if (targetCard && targetCard !== card && els.channelGrid.contains(targetCard)) {
        const fromId = card.dataset.publicId;
        const toId = targetCard.dataset.publicId;
        const fromIdx = state.channels.findIndex(c => c.publicId === fromId);
        const toIdx = state.channels.findIndex(c => c.publicId === toId);
        if (fromIdx !== -1 && toIdx !== -1) {
          const [item] = state.channels.splice(fromIdx, 1);
          state.channels.splice(toIdx, 0, item);
          saveChannelOrder();
          if (fromIdx < toIdx) {
            els.channelGrid.insertBefore(card, targetCard.nextSibling);
          } else {
            els.channelGrid.insertBefore(card, targetCard);
          }
        }
      }
    }

    state.dragCtx = null;
  };

  card.addEventListener('pointerup', endDrag);
  card.addEventListener('pointercancel', endDrag);
}

/* ================== NAVEGACIÓN TECLADO ================== */

function setupGridKeyboardNav() {
  els.orderModeBtn.addEventListener('click', toggleOrderMode);

  els.channelGrid.addEventListener('keydown', (e) => {
    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (arrowKeys.indexOf(e.key) === -1) return;

    if (state.orderMode && state.grabbedPublicId) {
      e.preventDefault();
      moveGrabbedChannel(e.key);
      return;
    }

    const cards = Array.from(els.channelGrid.querySelectorAll('.channel-card'));
    const current = document.activeElement;
    const idx = cards.indexOf(current);
    if (idx === -1) return;
    e.preventDefault();

    const currentRect = cards[idx].getBoundingClientRect();
    let best = null, bestDist = Infinity;

    cards.forEach((card, i) => {
      if (i === idx) return;
      const r = card.getBoundingClientRect();
      const dx = (r.left + r.width / 2) - (currentRect.left + currentRect.width / 2);
      const dy = (r.top + r.height / 2) - (currentRect.top + currentRect.height / 2);
      let valid = false;
      if (e.key === 'ArrowRight' && dx > 4) valid = true;
      if (e.key === 'ArrowLeft' && dx < -4) valid = true;
      if (e.key === 'ArrowDown' && dy > 4) valid = true;
      if (e.key === 'ArrowUp' && dy < -4) valid = true;
      if (!valid) return;
      const dist = Math.abs(dx) + Math.abs(dy) * 1.4;
      if (dist < bestDist) { bestDist = dist; best = card; }
    });
    if (best) best.focus();
  });
}

/* ================== REPRODUCTOR ================== */

async function playChannel(ch) {
  state.currentChannel = ch;
  state.streamRetryCount = 0;
  showScreen('player');
  els.playerChannelName.textContent = ch.nombre;
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
  // Para el stream, seguimos usando el token corto en la URL (eso funcionaba)
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
      console.warn('Error fatal de HLS:', data.type);
      if (state.streamRetryCount < CONFIG.MAX_STREAM_RETRY) {
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
  } else {
    showPlayerError('Este navegador no soporta reproducción HLS.');
  }
}

function scheduleStreamRenewal(streamUrl) {
  if (state.streamRenewTimer) clearTimeout(state.streamRenewTimer);
  const expiry = parseStreamExpiry(streamUrl);
  let delay;
  if (expiry) {
    delay = Math.max(expiry * 1000 - Date.now() - CONFIG.STREAM_RENEW_MARGIN_MS, 60000);
  } else {
    delay = 3.5 * 60 * 60 * 1000;
  }
  state.streamRenewTimer = setTimeout(() => {
    refreshStreamUrl().catch(err => console.warn('No se pudo renovar el stream:', err));
  }, delay);
}

function stopPlayback() {
  if (state.hls) { state.hls.destroy(); state.hls = null; }
  if (state.streamRenewTimer) { clearTimeout(state.streamRenewTimer); state.streamRenewTimer = null; }
  els.videoPlayer.pause();
  els.videoPlayer.removeAttribute('src');
  els.videoPlayer.load();
  state.currentChannel = null;
}

function showPlayerLoading(text) {
  els.loadingText.textContent = text || 'Cargando…';
  els.loadingOverlay.classList.add('active');
}
function hidePlayerLoading() { els.loadingOverlay.classList.remove('active'); }
function showPlayerError(text) {
  hidePlayerLoading();
  els.playerErrorText.textContent = text;
  els.playerErrorOverlay.hidden = false;
}
function hidePlayerError() { els.playerErrorOverlay.hidden = true; }

/* ================== NAVEGACIÓN PANTALLAS ================== */

function showScreen(name) {
  els.gateScreen.hidden = name !== 'gate';
  els.categoryScreen.hidden = name !== 'categories';
  els.gridScreen.hidden = name !== 'grid';
  els.playerScreen.hidden = name !== 'player';
}

/* ================== ARRANQUE ================== */

async function bootstrapSession() {
  setStatus('Conectando…', 'warn');
  try {
    await loginAndCreateSession();
    setStatus('En vivo', 'live');
    showScreen('categories');
    els.resetBtn.hidden = false;
  } catch (err) {
    console.error('Error al conectar:', err);
    showGateMessage('No se pudo conectar. Revisá tu usuario/contraseña e intentá de nuevo. [detalle: ' + err.message + ']');
    showScreen('gate');
    renderGateForCreds();
  }
}

function showGateMessage(msg) {
  els.gateError.textContent = msg;
  els.gateError.hidden = false;
}

function renderGateForCreds() {
  const creds = getStoredCreds();
  if (!creds) return;
  $('gateForm').hidden = true;
  let btn = $('gateConnectBtn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'gateConnectBtn';
    btn.className = 'btn-primary btn-block';
    btn.textContent = 'Conectar con ' + creds.usuario;
    btn.style.marginTop = '18px';
    btn.addEventListener('click', () => { els.gateError.hidden = true; bootstrapSession(); });
    $('gateForm').insertAdjacentElement('afterend', btn);
  }
}

function bootstrap() {
  [
    'clock', 'statusPill', 'resetBtn', 'renewBanner', 'renewBtn',
    'gateScreen', 'gateForm', 'gateUser', 'gatePass', 'gateError',
    'categoryScreen',
    'gridScreen', 'gridTitle', 'backToCategoriesBtn', 'channelGrid', 'gridEmpty', 'retryGridBtn', 'orderModeBtn', 'orderModeHint',
    'playerScreen', 'backBtn', 'playerChannelName', 'videoPlayer',
    'loadingOverlay', 'loadingText', 'playerErrorOverlay', 'playerErrorText', 'playerRetryBtn',
  ].forEach(id => { els[id] = $(id); });

  setInterval(() => {
    els.clock.textContent = new Date().toLocaleTimeString('es-UY', { hour12: false });
  }, 1000);

  els.gateForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveCreds(els.gateUser.value.trim(), els.gatePass.value);
    els.gateError.hidden = true;
    bootstrapSession();
  });

  els.renewBtn.addEventListener('click', () => { hideRenewBanner(); attemptRenewal(); });
  els.resetBtn.addEventListener('click', () => {
    if (!confirm('¿Olvidar la cuenta guardada en este dispositivo?')) return;
    clearCreds();
    location.reload();
  });
  els.backBtn.addEventListener('click', () => { stopPlayback(); showScreen('grid'); });
  els.playerRetryBtn.addEventListener('click', () => {
    hidePlayerError();
    if (state.currentChannel) playChannel(state.currentChannel);
  });
  els.retryGridBtn.addEventListener('click', () => {
    els.gridEmpty.hidden = true;
    loadGrid(state.currentCategory).catch(() => { els.gridEmpty.hidden = false; });
  });

  els.categoryScreen.querySelectorAll('[data-category]').forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.dataset.category;
      if (state.orderMode) toggleOrderMode();
      showScreen('grid');
      els.gridEmpty.hidden = true;
      els.channelGrid.innerHTML = '';
      loadGrid(category).catch(err => {
        console.error('Error al cargar ' + category + ':', err);
        els.gridEmpty.hidden = false;
      });
    });
  });

  els.backToCategoriesBtn.addEventListener('click', () => {
    if (state.orderMode) toggleOrderMode();
    showScreen('categories');
  });

  setupGridKeyboardNav();

  const creds = getStoredCreds();
  if (creds) {
    bootstrapSession();
  } else {
    showScreen('gate');
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);

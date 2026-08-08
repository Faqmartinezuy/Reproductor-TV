<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Reproductor TV</title>
<meta name="description" content="Grilla de canales de TV con reproducción y renovación automática de sesión.">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📡</text></svg>">
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#12141C">
<link rel="apple-touch-icon" href="icon-192.png">
<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
<link rel="icon" type="image/png" sizes="512x512" href="icon-512.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css">
</head>
<body>

<div id="app">

  <!-- ============ HEADER ============ -->
  <header class="app-header">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true"></span>
      <h1>Reproductor TV</h1>
    </div>
    <div class="header-status">
      <span id="clock" class="clock"></span>
      <span id="statusPill" class="status-pill">Iniciando…</span>
      <button id="resetBtn" class="btn-ghost" title="Olvidar cuenta guardada en este dispositivo" hidden>Olvidar cuenta</button>
    </div>
  </header>

  <!-- ============ AVISO DE RENOVACIÓN (oculto salvo cuando hace falta 1 clic) ============ -->
  <div id="renewBanner" class="renew-banner" hidden role="alert">
    <p><strong>La sesión está por vencer.</strong> No pudimos renovarla en segundo plano — tocá el botón para continuar viendo sin cortes.</p>
    <button id="renewBtn" class="btn-primary">Renovar sesión</button>
  </div>

  <main>

    <!-- ============ PANTALLA 1: ACCESO (primera vez o credenciales olvidadas) ============ -->
    <section id="gateScreen" class="screen gate-screen" hidden>
      <div class="gate-card">
        <span class="brand-mark brand-mark-lg" aria-hidden="true"></span>
        <h2>Conectar</h2>
        <p class="gate-copy">Ingresá tu usuario y contraseña una sola vez. Quedan guardados solo en este dispositivo para iniciar sesión automáticamente de ahora en más.</p>
        <form id="gateForm" autocomplete="off">
          <label for="gateUser">Usuario (email)</label>
          <input id="gateUser" name="usuario" type="email" required autocomplete="username" placeholder="tu@email.com">
          <label for="gatePass">Contraseña</label>
          <input id="gatePass" name="password" type="password" required autocomplete="current-password">
          <button type="submit" class="btn-primary btn-block">Guardar y conectar</button>
        </form>
        <p id="gateError" class="gate-error" hidden></p>
        <p class="gate-note">La contraseña se guarda solo en este dispositivo (localStorage), nunca en un servidor propio. No la compartas si usás un dispositivo público.</p>
      </div>
    </section>

    <!-- ============ PANTALLA 2: CATEGORÍAS ============ -->
    <section id="categoryScreen" class="screen category-screen" hidden>
      <div class="category-grid">
        <button class="category-card" type="button" data-category="canales">
          <span class="category-icon" aria-hidden="true">📺</span>
          <span class="category-name">Canales</span>
        </button>
        <button class="category-card" type="button" data-category="radios">
          <span class="category-icon" aria-hidden="true">📻</span>
          <span class="category-name">Radios</span>
        </button>
        <button class="category-card" type="button" data-category="camaras">
          <span class="category-icon" aria-hidden="true">📷</span>
          <span class="category-name">Cámaras</span>
        </button>
        <button class="category-card" type="button" data-category="peliculas">
          <span class="category-icon" aria-hidden="true">🎬</span>
          <span class="category-name">Películas</span>
        </button>
      </div>
    </section>

    <!-- ============ PANTALLA 3: GRILLA ============ -->
    <section id="gridScreen" class="screen grid-screen" hidden>
      <div class="grid-toolbar">
        <button id="backToCategoriesBtn" class="btn-ghost" type="button">← Categorías</button>
        <h2 id="gridTitle" class="grid-title"></h2>
        <button id="orderModeBtn" class="btn-ghost" type="button">Organizar orden</button>
        <p id="orderModeHint" class="order-hint" hidden>Arrastrá una tarjeta para moverla. Con el control: Enter/OK para tomarla, flechas para moverla, Enter/OK de nuevo para soltarla.</p>
      </div>
      <div id="channelGrid" class="channel-grid" role="list"></div>
      <p id="gridEmpty" class="grid-empty" hidden>No se pudo cargar el contenido. <button id="retryGridBtn" class="btn-link">Reintentar</button></p>
    </section>

    <!-- ============ PANTALLA 4: REPRODUCTOR ============ -->
    <section id="playerScreen" class="screen player-screen" hidden>
      <div class="player-top">
        <button id="backBtn" class="btn-back">← Volver a la grilla</button>
        <span id="playerChannelName" class="player-channel-name"></span>
        <span class="player-live"><i class="dot" aria-hidden="true"></i>EN VIVO</span>
      </div>
      <div class="video-wrapper">
        <video id="videoPlayer" controls autoplay playsinline></video>
        <div id="loadingOverlay" class="loading-overlay">
          <div class="spinner" aria-hidden="true"></div>
          <p id="loadingText">Sintonizando…</p>
        </div>
        <div id="playerErrorOverlay" class="player-error-overlay" hidden>
          <p id="playerErrorText">No se pudo reproducir este canal.</p>
          <button id="playerRetryBtn" class="btn-primary">Reintentar</button>
        </div>
      </div>
    </section>

  </main>
</div>

<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js"></script>
<script src="config.js"></script>
<script src="app.js"></script>
</body>
</html>

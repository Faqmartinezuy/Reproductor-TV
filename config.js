/**
 * config.js — (REPRODUCTOR TV)
 * Configuración de endpoints, listas y credenciales por defecto para auto-login.
 */

const CONFIG = {
  // Credenciales por defecto para el inicio automático silencioso.
  // En producción (ej. Vercel), estas variables se leen desde el entorno.
  // Si no usas bundler, se usarán las cadenas vacías y se le pedirán al usuario en la primera pantalla.
  DEFAULT_USER: typeof process !== 'undefined' && process.env ? process.env.AUTO_LOGIN_USER : '',
  DEFAULT_PASS: typeof process !== 'undefined' && process.env ? process.env.AUTO_LOGIN_PASS : '',

  LOGIN_API: '/api/login',
  SETUP_API: 'https://veratv-be.vera.com.uy/api/setup',

  // Base de la API de grillas de contenido. Cada categoría es una lista
  // distinta dentro del mismo servicio (ver CONFIG.LISTAS).
  GRID_API_BASE: 'https://cds-frontend.vera.com.uy/api-contenidos/listas',
  GRID_HEADERS: { 'x-service-id': '3', 'x-frontend-id': '1196', 'x-system-id': '1' },

  // IDs de lista confirmados mirando la red del sitio oficial (anteltv.com.uy).
  LISTAS: {
    canales: 68,
    radios: 221,
    camaras: 139,
    peliculas: 250, // "Cine Uruguayo" en el menú oficial
  },
  CATEGORY_LABELS: {
    canales: 'Canales',
    radios: 'Radios',
    camaras: 'Cámaras',
    peliculas: 'Películas',
  },
  CATEGORY_ORDER: ['canales', 'radios', 'camaras', 'peliculas'],

  SESSION_API: 'https://veratv-be.vera.com.uy/api/sesiones',
  DOMINIO: 'lua',
  SESSION_RENEW_MARGIN_MS: 10 * 60 * 1000,
  STREAM_RENEW_MARGIN_MS: 8 * 60 * 1000,
  MAX_STREAM_RETRY: 3,
  STORAGE_KEYS: {
    usuario: 'antel_usuario',
    password: 'antel_password_b64',
    lastChannel: 'antel_ultimo_canal',
    order: 'antel_orden_canales', // se usa para "canales"; otras categorías agregan un sufijo
  },

  // Canales sin señal — se sacan de la grilla de "Canales". La comparación
  // ignora mayúsculas/minúsculas, acentos y espacios/puntuación.
  EXCLUDED_CHANNELS: [
    'Antel TV internacional',
    'Antel TV internacional 2',
    'Antel TV Internacional 1',
    'Inti',
    'ABC',
    'Mi móvil TV',
    'Siemprecine',
    'Cardinal',
    'Cardinal TV',
    'UCL',
  ],

  // Orden preferido para la grilla de "Canales": estos van primero, en este
  // orden. Los canales que no están en esta lista quedan después, en el
  // mismo orden relativo en que los devuelve la API.
  CHANNEL_PRIORITY_ORDER: [
    'Canal 4',
    'Canal 5',
    'VTV',
    'VTV Plus',
    'VTV Futbol',
    'VTV Futbol 2',
    'TV Ciudad',
    'A+V',
    'Canal 7 Punta',
    'Canal 2 Lascano',
    '9 de Rocha',
    'DW',
    'France 24',
    'CGTN',
    'RT',
    'Telesur',
  ],
};

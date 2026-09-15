/**
 * config.js — (REPRODUCTOR TV)
 */

const CONFIG = {
  // Credenciales por defecto para auto-login automático
  DEFAULT_USER: 'william.s.martinez@hotmail.com',
  DEFAULT_PASS: 'wilymanya1979',

  LOGIN_API: 'https://veratv-be.vera.com.uy/api/usuarios/login',
  SETUP_API: 'https://veratv-be.vera.com.uy/api/setup',

  GRID_API_BASE: 'https://cds-frontend.vera.com.uy/api-contenidos/listas',
  GRID_HEADERS: { 'x-service-id': '3', 'x-frontend-id': '1196', 'x-system-id': '1' },

  LISTAS: {
    canales: 68,
    radios: 221,
    camaras: 139,
    peliculas: 250,
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
    order: 'antel_orden_canales',
  },

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

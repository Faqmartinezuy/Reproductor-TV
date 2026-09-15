/**
 * config.js — Configuración general de la aplicación
 */
const CONFIG = {
  LOGIN_API: 'https://catalog.anteltv.com.uy/api/v1/auth/login',
  SESSION_API: 'https://catalog.anteltv.com.uy/api/v1/sesiones',
  SETUP_API: 'https://catalog.anteltv.com.uy/api/v1/contenido/setup',
  GRID_API_BASE: 'https://catalog.anteltv.com.uy/api/v1/listas',
  DOMINIO: 'anteltv',
  MAX_STREAM_RETRY: 3,
  STREAM_RENEW_MARGIN_MS: 30000,
  SESSION_RENEW_MARGIN_MS: 60000,
  STORAGE_KEYS: {
    usuario: 'tv_user',
    password: 'tv_pass',
    order: 'tv_order'
  },
  LISTAS: {
    canales: 'canales_principales'
  },
  CATEGORY_LABELS: {
    canales: 'Canales de TV',
    radios: 'Radios',
    camaras: 'Cámaras',
    peliculas: 'Películas'
  },
  EXCLUDED_CHANNELS: []
};

const CONFIG = {
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
  SESSION_RENEW_MARGIN_MS: 5 * 60 * 1000,
  STREAM_RENEW_MARGIN_MS: 2 * 60 * 1000,
  MAX_STREAM_RETRY: 3,
  STORAGE_KEYS: {
    usuario: 'antel_usuario',
    password: 'antel_password_b64',
    lastChannel: 'antel_ultimo_canal',
    order: 'antel_orden_canales', // se usa para "canales"; otras categorías agregan un sufijo
  },

  // Sin exclusiones: se deja el arreglo vacío para que NO se oculte ningún canal.
  EXCLUDED_CHANNELS: [],

  // Orden preferido para la grilla de "Canales": se incluyen al inicio los que antes estaban
  // excluidos junto con variantes de nombre para asegurar su posicionamiento.
  CHANNEL_PRIORITY_ORDER: [
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
    'Canal 4',
    'Canal 5',
    'VTV',
    'VTV Plus',
    'VTV Plus 2',
    'VTV Futbol',
    'VTV Futbol 2',
    'VTV Futbol 3',
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

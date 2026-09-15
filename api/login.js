/**
 * api/login.js — Vercel Serverless Function
 */

const crypto = require('crypto');

const CLIENT_ID = 'veratv-beta';
const REDIRECT_URI = 'https://tv.vera.com.uy/';
const OIDC_AUTHORIZE_URL = 'https://login.vera.com.uy/oidc/authorize';
const DOMINIO = 'lua';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // Toma credenciales del body o usa las por defecto
  const bodyData = req.body || {};
  const usuario = bodyData.usuario || 'william.s.martinez@hotmail.com';
  const password = bodyData.password || 'wilymanya1979';

  if (!usuario || !password) {
    return res.status(400).json({ error: 'missing_credentials' });
  }

  const jar = new CookieJar();

  try {
    // --- Paso 1: Pedir autorización OIDC ---
    const authorizeUrl = buildAuthorizeUrl();
    const step1 = await jar.fetch(authorizeUrl);
    assertRedirect(step1, 'PASO_1_AUTHORIZE');
    const loginPageUrl = step1.headers.get('location');

    // --- Paso 2: Obtener página de login y campos ocultos ---
    const step2 = await jar.fetch(loginPageUrl);
    if (step2.status !== 200) throw new AppError('PASO_2_LOGIN_PAGE', `status ${step2.status}`);
    const html = await step2.text();
    const hiddenFields = parseHiddenFields(html);
    if (!hiddenFields.execution) {
      throw new AppError('PASO_2_SIN_EXECUTION', 'No se encontró el campo "execution" en el formulario de CAS');
    }

    // --- Paso 3: Enviar formulario de credenciales ---
    const body = new URLSearchParams({
      ...hiddenFields,
      username: usuario,
      password: password,
      _eventId: hiddenFields._eventId || 'submit',
      geolocation: hiddenFields.geolocation || '',
    });

    const step3 = await jar.fetch(loginPageUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    assertRedirect(step3, 'PASO_3_CREDENCIALES (Usuario o contraseña incorrectos)');
    const ticketUrl = step3.headers.get('location');

    // --- Paso 4: Validar Ticket CAS ---
    const step4 = await jar.fetch(ticketUrl);
    assertRedirect(step4, 'PASO_4_TICKET');
    const backToOidcUrl = step4.headers.get('location');

    // --- Paso 5: Confirmar sesión en OIDC ---
    const step5 = await jar.fetch(backToOidcUrl);
    assertRedirect(step5, 'PASO_5_OIDC_FINAL');
    const finalUrl = step5.headers.get('location');

    // --- Extraer token final ---
    const idToken = extractIdToken(finalUrl);
    if (!idToken) throw new AppError('PASO_5_SIN_TOKEN', `No se encontró id_token en: ${finalUrl}`);

    return res.status(200).json({
      id_token: idToken,
      usuario: usuario,
      dominio: DOMINIO,
    });
  } catch (err) {
    console.error('Login error:', err.step || 'General', '-', err.message);
    return res.status(502).json({
      error: 'login_failed',
      step: err.step || null,
      detail: err.message,
    });
  }
};

/* ==================== UTILIDADES ==================== */

class AppError extends Error {
  constructor(step, message) {
    super(message);
    this.step = step;
  }
}

function assertRedirect(response, step) {
  if (response.status < 300 || response.status >= 400 || !response.headers.get('location')) {
    throw new AppError(step, `Se esperaba redirección (30x) y se obtuvo status ${response.status}`);
  }
}

function buildAuthorizeUrl() {
  const state = randomHex(16);
  const nonce = randomHex(16);
  const qs = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'id_token token',
    scope: 'openid',
    state,
    nonce,
    service: REDIRECT_URI,
  });
  return `${OIDC_AUTHORIZE_URL}?${qs.toString()}`;
}

function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

function parseHiddenFields(html) {
  const hiddenFields = {};
  const inputRe = /<input\b[^>]*>/gi;
  let m;
  while ((m = inputRe.exec(html))) {
    const tag = m[0];
    if (!/type\s*=\s*"hidden"/i.test(tag)) continue;
    const nameMatch = tag.match(/name\s*=\s*"([^"]+)"/i);
    const valueMatch = tag.match(/value\s*=\s*"([^"]*)"/i);
    if (nameMatch) hiddenFields[nameMatch[1]] = valueMatch ? valueMatch[1].replace(/&amp;/g, '&') : '';
  }
  return hiddenFields;
}

function extractIdToken(url) {
  const hashIdx = url.indexOf('#');
  if (hashIdx === -1) return null;
  const params = new URLSearchParams(url.slice(hashIdx + 1));
  return params.get('id_token');
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  header() {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  store(response) {
    let setCookie = [];
    if (typeof response.headers.getSetCookie === 'function') {
      setCookie = response.headers.getSetCookie();
    } else if (response.headers.raw && response.headers.raw()['set-cookie']) {
      setCookie = response.headers.raw()['set-cookie'];
    } else {
      const headerVal = response.headers.get('set-cookie');
      if (headerVal) setCookie = [headerVal];
    }

    for (const c of setCookie) {
      const pair = c.split(';')[0];
      const idx = pair.indexOf('=');
      if (idx > -1) {
        this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
      }
    }
  }

  async fetch(url, opts = {}) {
    const response = await fetch(url, {
      ...opts,
      redirect: 'manual',
      headers: {
        ...(opts.headers || {}),
        Cookie: this.header(),
        'User-Agent': UA,
      },
    });
    this.store(response);
    return response;
  }
}

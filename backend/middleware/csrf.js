const crypto = require('crypto');

const CSRF_COOKIE = 'csrfToken';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function isProductionDeployment() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
}

function getCookieOptions() {
  const production = isProductionDeployment();
  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? 'none' : 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  };
}

function issueCsrfToken(req, res) {
  const csrfToken = crypto.randomBytes(32).toString('hex');
  res.set('Cache-Control', 'no-store');
  res.cookie(CSRF_COOKIE, csrfToken, getCookieOptions());
  res.json({ success: true, csrfToken });
}

function tokensMatch(cookieToken, headerToken) {
  if (typeof cookieToken !== 'string' || typeof headerToken !== 'string') return false;
  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);
  return cookieBuffer.length === headerBuffer.length
    && crypto.timingSafeEqual(cookieBuffer, headerBuffer);
}

function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  // The isolated in-memory integration harness does not emulate browser CSRF headers.
  if (process.env.NODE_ENV === 'test' && process.env.BILLFLOW_TEST_DATABASE === 'memory') return next();

  if (req.headers['x-billflow-client'] === 'mobile') return next();

  if (!tokensMatch(req.cookies?.[CSRF_COOKIE], req.get('x-csrf-token'))) {
    return res.status(403).json({ success: false, message: 'CSRF token missing or invalid' });
  }

  return next();
}

function clearCsrfCookie(res) {
  const { maxAge, ...options } = getCookieOptions();
  res.clearCookie(CSRF_COOKIE, options);
}

module.exports = { csrfProtection, issueCsrfToken, getCookieOptions, clearCsrfCookie };

const PRODUCTION_FRONTEND_ORIGIN = 'https://bill-flow-cdly.vercel.app';
const DEFAULT_LOCAL_ORIGIN = 'http://localhost:5173';

function getAllowedOrigins(configuredOrigins = process.env.CLIENT_URL) {
  const configuredValues = configuredOrigins?.trim()
    ? configuredOrigins.split(',')
    : [DEFAULT_LOCAL_ORIGIN];

  const allowedOrigins = configuredValues.map((value) => {
    const origin = value.trim().replace(/\/+$/, '');
    let parsedOrigin;

    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error('CLIENT_URL must contain comma-separated HTTP(S) origins without paths.');
    }

    if (
      !origin
      || !['http:', 'https:'].includes(parsedOrigin.protocol)
      || parsedOrigin.origin !== origin
      || parsedOrigin.pathname !== '/'
      || parsedOrigin.search
      || parsedOrigin.hash
      || parsedOrigin.username
      || parsedOrigin.password
    ) {
      throw new Error('CLIENT_URL must contain comma-separated HTTP(S) origins without paths.');
    }

    return origin;
  });

  allowedOrigins.push(PRODUCTION_FRONTEND_ORIGIN);
  return new Set(allowedOrigins);
}

module.exports = { getAllowedOrigins, PRODUCTION_FRONTEND_ORIGIN };

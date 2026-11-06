const request = require('supertest');
const app = require('../app');
const { getAllowedOrigins, PRODUCTION_FRONTEND_ORIGIN } = require('../config/cors');

describe('CORS configuration', () => {
  it('allows the production frontend origin exactly', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', PRODUCTION_FRONTEND_ORIGIN);

    expect(response.headers['access-control-allow-origin']).toBe(PRODUCTION_FRONTEND_ORIGIN);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not grant CORS access to an unapproved origin', async () => {
    const response = await request(app)
      .options('/api/health')
      .set('Origin', 'https://unapproved.example')
      .set('Access-Control-Request-Method', 'GET');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('answers credentialed preflight requests with allowed methods and requested headers', async () => {
    const response = await request(app)
      .options('/api/auth/login')
      .set('Origin', PRODUCTION_FRONTEND_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,authorization,x-xsrf-token');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(PRODUCTION_FRONTEND_ORIGIN);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-headers']).toBe('content-type,authorization,x-xsrf-token');
  });

  it('accepts multiple origins with trailing slashes but rejects API paths', () => {
    expect(getAllowedOrigins('https://admin.example/,https://billing.example///')).toEqual(
      new Set([
        'https://admin.example',
        'https://billing.example',
        PRODUCTION_FRONTEND_ORIGIN,
      ]),
    );
    expect(() => getAllowedOrigins('https://billing.example/api')).toThrow(
      'CLIENT_URL must contain comma-separated HTTP(S) origins without paths.',
    );
  });
});

const request = require('supertest');

jest.mock('../config/db', () => ({
  ...jest.requireActual('../config/db'),
  connectDB: jest.fn(),
}));

const { connectDB } = require('../config/db');
const app = require('../app');

describe('Vercel proxy and request startup', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercel = process.env.VERCEL;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.VERCEL;
    connectDB.mockReset();
  });

  afterAll(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  });

  it('trusts exactly one Vercel proxy and runs health and auth limiters without forwarded-header errors', async () => {
    expect(app.get('trust proxy')).toBe(1);
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    const proxyHeaders = {
      'X-Forwarded-For': '198.51.100.10',
      Forwarded: 'for=198.51.100.10;proto=https',
    };

    await request(app).get('/api/health').set(proxyHeaders).expect(503).expect((response) => {
      expect(response.body.database).toBe('disconnected');
    });
    await request(app).post('/api/auth/login')
      .set(proxyHeaders)
      .set('X-BillFlow-Client', 'mobile')
      .send({})
      .expect(400);

    expect(errorLog).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it('connects MongoDB on the Vercel Express entrypoint before handling API routes', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL = '1';
    connectDB.mockResolvedValue();

    await request(app).get('/api/not-found')
      .set('X-Forwarded-For', '198.51.100.10')
      .set('Forwarded', 'for=198.51.100.10;proto=https')
      .expect(404);

    expect(connectDB).toHaveBeenCalledTimes(1);
  });

  it('logs MongoDB configuration failures by category without exposing URI contents', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL = '1';
    connectDB.mockRejectedValue(new Error('MONGODB_URI is required. Configure it in backend/.env or the process environment.'));
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});

    await request(app).get('/api/health')
      .set('X-Forwarded-For', '198.51.100.10')
      .set('Forwarded', 'for=198.51.100.10;proto=https')
      .expect(503)
      .expect((response) => {
        expect(response.body.database).toBe('disconnected');
      });

    expect(errorLog).toHaveBeenCalledWith('MONGODB_URI is missing from the backend environment.');
    expect(errorLog.mock.calls.flat().join(' ')).not.toMatch(/mongodb(?:\+srv)?:\/\/|password|username/i);
    errorLog.mockRestore();
  });
});

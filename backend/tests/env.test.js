const { getMongoUri } = require('../config/env');
const path = require('path');
const { spawnSync } = require('node:child_process');

describe('MongoDB environment configuration', () => {
  it('uses the canonical URI and trims surrounding whitespace', () => {
    expect(getMongoUri({ MONGODB_URI: ' mongodb://localhost:27017/billflow ' }))
      .toBe('mongodb://localhost:27017/billflow');
  });

  it('supports the legacy variable with a deprecation warning', () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(getMongoUri({ MONGO_URI: 'mongodb://localhost:27017/billflow' }))
      .toBe('mongodb://localhost:27017/billflow');
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('MONGO_URI is deprecated'));
    warning.mockRestore();
  });

  it('rejects missing and malformed URIs without printing their values', () => {
    expect(() => getMongoUri({})).toThrow('MONGODB_URI is required');
    expect(() => getMongoUri({ MONGODB_URI: 'not-a-mongodb-uri' })).toThrow('MONGODB_URI is invalid');
    expect(() => getMongoUri({ MONGODB_URI: 'https://example.test' })).toThrow('must use the mongodb://');
  });

  it('rejects conflicting canonical and legacy values', () => {
    expect(() => getMongoUri({
      MONGODB_URI: 'mongodb://localhost:27017/billflow',
      MONGO_URI: 'mongodb://localhost:27018/billflow',
    })).toThrow('do not match');
  });

  it('loads the backend .env URI when an inherited variable is blank', () => {
    const result = spawnSync(process.execPath, [
      '-e',
      "process.env.MONGODB_URI = ''; require('./config/env'); console.log(process.env.MONGODB_URI?.trim() ? 'configured' : 'missing');",
    ], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('configured');
  });
});

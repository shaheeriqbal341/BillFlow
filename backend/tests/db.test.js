jest.mock('mongoose', () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('mongodb-memory-server', () => ({
  MongoMemoryServer: { create: jest.fn() },
}));

const mongoose = require('mongoose');
const { connectDB } = require('../config/db');

describe('MongoDB connection', () => {
  beforeEach(() => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017';
    delete process.env.MONGO_URI;
    delete process.env.BILLFLOW_TEST_DATABASE;
    mongoose.connect.mockReset();
    mongoose.disconnect.mockReset().mockResolvedValue();
  });

  it('connects to the billflow database using the shared URI', async () => {
    mongoose.connect.mockResolvedValue();

    await connectDB();

    expect(mongoose.connect).toHaveBeenCalledWith(
      'mongodb://localhost:27017',
      { dbName: 'billflow' },
    );
  });

  it('reports SRV DNS response failures without exposing the URI', async () => {
    mongoose.connect.mockRejectedValue(Object.assign(new Error('querySrv EBADRESP'), {
      name: 'MongoServerSelectionError',
      code: 'EBADRESP',
    }));

    const error = await connectDB().catch((connectionError) => connectionError);

    expect(error.message).toContain('SRV DNS lookup failed');
    expect(error.message).not.toContain('mongodb://');
    expect(mongoose.disconnect).toHaveBeenCalled();
  });

  it('distinguishes server selection timeouts', async () => {
    mongoose.connect.mockRejectedValue(Object.assign(new Error('Server selection timed out'), {
      name: 'MongoServerSelectionError',
      code: 'ETIMEDOUT',
    }));

    await expect(connectDB()).rejects.toThrow('MongoDB connection timed out');
  });

  it('requires a URI outside the explicit in-memory test mode', async () => {
    delete process.env.MONGODB_URI;

    await expect(connectDB()).rejects.toThrow('MONGODB_URI is required');
    expect(mongoose.connect).not.toHaveBeenCalled();
  });
});

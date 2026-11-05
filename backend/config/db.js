const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { getMongoUri } = require('./env');

let mongoMemoryServer;

function getConnectionFailure(error) {
  const chain = [];
  let current = error;
  while (current && !chain.includes(current)) {
    chain.push(current);
    current = current.cause;
  }

  const names = chain.map((item) => item.name);
  const codes = chain.map((item) => item.code);
  const messages = chain.map((item) => item.message || '').join(' ');

  if (codes.includes(18) || /authentication failed|authenticationfailure/i.test(messages)) {
    return 'MongoDB authentication failed. Check the database username, password, and authentication database in the configured URI.';
  }
  if (names.includes('MongoParseError')) {
    return 'MongoDB rejected the connection string format. Check MONGODB_URI without sharing it in logs.';
  }
  if (codes.includes('EBADRESP') || /querysrv/i.test(messages)) {
    return 'MongoDB SRV DNS lookup failed. Check the configured Atlas hostname and the machine or network DNS resolver.';
  }
  if (codes.includes('ETIMEDOUT') || names.includes('MongoNetworkTimeoutError') || /server selection timed out|timed out/i.test(messages)) {
    return 'MongoDB connection timed out. Check cluster availability, DNS, outbound network access, and Atlas Network Access.';
  }
  if (codes.some((code) => ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET'].includes(code))
    || /enotfound|eai_again|econnrefused|econnreset/i.test(messages)) {
    return 'MongoDB host could not be reached. Check the cluster hostname, DNS, outbound network access, and Atlas Network Access.';
  }
  if (names.includes('MongoServerSelectionError')) {
    return 'MongoDB server selection failed. Check cluster availability, DNS, outbound network access, and Atlas Network Access.';
  }

  const errorName = names[0] || 'MongoDB error';
  return `MongoDB connection failed (${errorName}). Check the configured URI, credentials, DNS, and Atlas Network Access.`;
}

async function connectDB() {
  const useTestDatabase = process.env.NODE_ENV === 'test'
    && process.env.BILLFLOW_TEST_DATABASE === 'memory';

  if (useTestDatabase) {
    mongoMemoryServer = await MongoMemoryServer.create({
      instance: { dbName: 'billflow' },
    });

    await mongoose.connect(mongoMemoryServer.getUri());
    console.log('Connected to in-memory MongoDB');
    return;
  }

  const mongoUri = getMongoUri();

  try {
    await mongoose.connect(mongoUri, { dbName: 'billflow' });
  } catch (error) {
    const failure = getConnectionFailure(error);
    try {
      await mongoose.disconnect();
    } catch (cleanupError) {
      console.error(`MongoDB cleanup after failed connection also failed (${cleanupError.name || 'error'}).`);
    }
    throw new Error(failure);
  }
  console.log('Connected to configured MongoDB database');
}

async function disconnectDB() {
  const server = mongoMemoryServer;
  mongoMemoryServer = undefined;
  try {
    await mongoose.disconnect();
  } finally {
    if (server) {
      await server.stop();
    }
  }
}

module.exports = { connectDB, disconnectDB };

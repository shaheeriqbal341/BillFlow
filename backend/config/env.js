const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '..', '.env');
const envResult = dotenv.config({ path: envPath });

if (envResult.parsed) {
  for (const [key, value] of Object.entries(envResult.parsed)) {
    if (!process.env[key]?.trim()) {
      process.env[key] = value;
    }
  }
}

function getMongoUri(environment = process.env) {
  const configuredUri = environment.MONGODB_URI?.trim();
  const legacyUri = environment.MONGO_URI?.trim();

  if (configuredUri && legacyUri && configuredUri !== legacyUri) {
    throw new Error('MONGODB_URI and legacy MONGO_URI are both set but do not match. Configure only MONGODB_URI.');
  }

  const mongoUri = configuredUri || legacyUri;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required. Configure it in backend/.env or the process environment.');
  }

  let parsedUri;
  try {
    parsedUri = new URL(mongoUri);
  } catch {
    throw new Error('MONGODB_URI is invalid. Use a valid mongodb:// or mongodb+srv:// connection string.');
  }
  if (!['mongodb:', 'mongodb+srv:'].includes(parsedUri.protocol)) {
    throw new Error('MONGODB_URI must use the mongodb:// or mongodb+srv:// protocol.');
  }

  if (!configuredUri && legacyUri) {
    console.warn('MONGO_URI is deprecated; rename it to MONGODB_URI when convenient.');
  }

  return mongoUri;
}

module.exports = { getMongoUri };

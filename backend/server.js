require('./config/env');
const app = require('./app');
const { connectDB } = require('./config/db');

const PORT = Number(process.env.PORT || 5000);

async function startServer() {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error('PORT must be a valid TCP port between 1 and 65535.');
  }
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required. Configure it in backend/.env.');
  }

  await connectDB();
  const server = app.listen(PORT, () => {
    console.log(`BillFlow backend running on port ${PORT}`);
  });
  server.on('error', (error) => {
    console.error(`BillFlow could not listen on port ${PORT} (${error.code || 'server error'}).`);
    process.exit(1);
  });
}

startServer().catch((error) => {
  console.error('BillFlow backend startup failed:', error.message);
  process.exit(1);
});

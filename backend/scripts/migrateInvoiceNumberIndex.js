const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');

async function migrateInvoiceNumberIndex() {
  await connectDB();
  const collection = mongoose.connection.collection('invoices');
  const indexes = await collection.indexes();
  const legacyIndex = indexes.find((index) => index.name === 'invoiceNumber_1');
  if (legacyIndex) await collection.dropIndex(legacyIndex.name);
  await collection.createIndex({ businessId: 1, invoiceNumber: 1 }, { unique: true, name: 'businessId_1_invoiceNumber_1' });
  console.log('Invoice number uniqueness is now scoped to each business; invoice data was not modified.');
}

async function main() {
  let exitCode = 0;
  try {
    await migrateInvoiceNumberIndex();
  } catch (error) {
    console.error(error.message);
    exitCode = 1;
  } finally {
    try {
      await disconnectDB();
    } catch (error) {
      console.error(`MongoDB disconnect failed (${error.name || 'error'}).`);
      exitCode = 1;
    }
  }
  process.exitCode = exitCode;
}

main();

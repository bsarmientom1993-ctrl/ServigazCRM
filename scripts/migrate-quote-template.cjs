const { PrismaClient } = require('@prisma/client');
const { databaseUrl } = require('./migrate-inventory.cjs');
async function migrateQuoteTemplate(client) {
  await client.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "FormatoCotizacion" (
    "id" TEXT PRIMARY KEY, "formato" JSONB NOT NULL, "modificadoPor" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
}
module.exports = { migrateQuoteTemplate };
if (require.main === module) {
  const url = databaseUrl(process.env);
  if (!url) { console.error('Falta la conexión para el formato de cotizaciones.'); process.exitCode = 1; }
  else { const client = new PrismaClient({ datasources: { db: { url } } }); migrateQuoteTemplate(client).then(() => console.log('Formato de cotizaciones preparado.')).catch(error => { console.error('No se pudo preparar el formato:', error.code || error.name); process.exitCode = 1; }).finally(() => client.$disconnect()); }
}

const { PrismaClient } = require('@prisma/client');
const { databaseUrl } = require('./migrate-inventory.cjs');
async function migrateStore(client) {
  await client.$transaction(async tx => {
    await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "TiendaConfiguracion" ("id" TEXT PRIMARY KEY, "datos" JSONB NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "TiendaPublicacion" (
      "productoId" TEXT PRIMARY KEY REFERENCES "ProductoInventario"("id"), "descripcion" TEXT NOT NULL DEFAULT '',
      "publicado" BOOLEAN NOT NULL DEFAULT false, "destacado" BOOLEAN NOT NULL DEFAULT false,
      "imagenContenido" BYTEA, "imagenKey" TEXT, "imagenHash" TEXT, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  });
}
module.exports = { migrateStore };
if (require.main === module) {
  const url = databaseUrl(process.env);
  if (!url) { console.error('Falta conexión para la tienda.'); process.exitCode = 1; }
  else { const client = new PrismaClient({ datasources: { db: { url } } }); migrateStore(client).then(() => console.log('Tienda preparada.')).catch(error => { console.error('No se pudo preparar la tienda:', error.code || error.name); process.exitCode = 1; }).finally(() => client.$disconnect()); }
}

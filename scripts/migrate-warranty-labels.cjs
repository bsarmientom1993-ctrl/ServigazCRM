const { PrismaClient } = require('@prisma/client');
const { databaseUrl } = require('./migrate-inventory.cjs');
async function migrateWarrantyLabels(client) {
  await client.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(742391)`;
    await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "EtiquetaGarantia" (
      "id" TEXT PRIMARY KEY, "trabajoId" TEXT NOT NULL REFERENCES "Trabajo"("id") ON DELETE CASCADE,
      "codigo" TEXT NOT NULL UNIQUE, "operacion" TEXT NOT NULL CHECK ("operacion" IN ('REVISION','VENTA')),
      "equipo" TEXT NOT NULL, "marca" TEXT NOT NULL, "modelo" TEXT NOT NULL, "serie" TEXT NOT NULL,
      "cobertura" TEXT NOT NULL, "condiciones" TEXT NOT NULL,
      "fechaInicio" TIMESTAMP(3) NOT NULL, "fechaFin" TIMESTAMP(3) NOT NULL,
      "emitidaPorId" TEXT NOT NULL, "emitidaPorNombre" TEXT NOT NULL, "solicitudHash" TEXT NOT NULL,
      "anuladaAt" TIMESTAMP(3), "anuladaPorId" TEXT, "anuladaPorNombre" TEXT, "motivoAnulacion" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK ("fechaFin" > "fechaInicio")
    )`);
    await tx.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "EtiquetaGarantia_trabajoId_createdAt_idx" ON "EtiquetaGarantia" ("trabajoId", "createdAt")');
  });
}
module.exports = { migrateWarrantyLabels };
if (require.main === module) {
  const url = databaseUrl(process.env);
  if (!url) throw new Error('No hay conexión para registrar etiquetas de garantía.');
  const client = new PrismaClient({ datasources: { db: { url } } });
  migrateWarrantyLabels(client).then(() => console.log('Etiquetas de garantía disponibles.'))
    .catch(error => { console.error('No se pudo preparar etiquetas:', error.code || error.name); process.exitCode = 1; })
    .finally(() => client.$disconnect());
}

const { PrismaClient } = require("@prisma/client");
const { databaseUrl } = require("./migrate-inventory.cjs");
async function migratePhotos(client) {
  await client.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(742383)`;
    await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "FotoTrabajo" (
      "id" TEXT PRIMARY KEY, "trabajoId" TEXT NOT NULL REFERENCES "Trabajo"("id") ON DELETE CASCADE,
      "autorId" TEXT NOT NULL REFERENCES "Usuario"("id"), "autorNombre" TEXT NOT NULL,
      "etapa" TEXT NOT NULL CHECK ("etapa" IN ('INICIAL', 'FINAL')), "descripcion" TEXT NOT NULL DEFAULT '',
      "contenido" BYTEA NOT NULL CHECK (octet_length("contenido") <= 786432), "sha256" TEXT NOT NULL,
      "ancho" INTEGER NOT NULL, "alto" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await tx.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "FotoTrabajo_trabajoId_etapa_sha256_key" ON "FotoTrabajo" ("trabajoId", "etapa", "sha256")');
    await tx.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "FotoTrabajo_trabajoId_etapa_createdAt_idx" ON "FotoTrabajo" ("trabajoId", "etapa", "createdAt")');
  }, { timeout: 60000 });
}
module.exports = { migratePhotos };
if (require.main === module) {
  const url = databaseUrl(process.env);
  if (!url) { console.error("No hay conexión configurada para el registro fotográfico."); process.exitCode = 1; }
  else { const client = new PrismaClient({ datasources: { db: { url } } }); migratePhotos(client).then(()=>console.log("Registro fotográfico preparado.")).catch(error=>{console.error("No se pudo preparar el registro fotográfico:",error.code || error.name);process.exitCode=1;}).finally(()=>client.$disconnect()); }
}

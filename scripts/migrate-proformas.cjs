const { PrismaClient } = require('@prisma/client');
const { databaseUrl } = require('./migrate-inventory.cjs');
async function migrateProformas(client) {
  await client.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(742385)`;
    await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "DocumentoProforma" (
      "id" TEXT PRIMARY KEY, "numero" SERIAL UNIQUE, "tipo" TEXT NOT NULL CHECK ("tipo" IN ('CLIENTE','MATERIALES')),
      "estado" TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK ("estado" IN ('PENDIENTE','APROBADA','RECHAZADA','ANULADA')),
      "ubicacionId" TEXT NOT NULL REFERENCES "UbicacionInventario"("id"), "clienteId" TEXT REFERENCES "Cliente"("id"),
      "tecnicoId" TEXT REFERENCES "Usuario"("id"), "trabajoId" TEXT REFERENCES "Trabajo"("id"),
      "creadoPorId" TEXT NOT NULL REFERENCES "Usuario"("id"), "datos" JSONB NOT NULL, "validoHasta" TIMESTAMP(3) NOT NULL,
      "decisionMotivo" TEXT, "decididoPorId" TEXT REFERENCES "Usuario"("id"),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (("tipo"='CLIENTE' AND "clienteId" IS NOT NULL) OR ("tipo"='MATERIALES' AND "tecnicoId" IS NOT NULL AND "trabajoId" IS NOT NULL)))`);
    await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "EntregaMaterial" (
      "id" TEXT PRIMARY KEY, "numero" SERIAL UNIQUE, "proformaId" TEXT NOT NULL REFERENCES "DocumentoProforma"("id"),
      "creadoPorId" TEXT NOT NULL REFERENCES "Usuario"("id"), "creadoPorNombre" TEXT NOT NULL, "huella" TEXT NOT NULL,
      "observaciones" TEXT NOT NULL, "recibidoAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "EntregaMaterialItem" (
      "id" TEXT PRIMARY KEY, "entregaId" TEXT NOT NULL REFERENCES "EntregaMaterial"("id"), "productoId" TEXT NOT NULL REFERENCES "ProductoInventario"("id"),
      "descripcion" TEXT NOT NULL, "unidad" TEXT NOT NULL, "cantidad" DECIMAL(10,2) NOT NULL CHECK ("cantidad">0),
      "consumida" DECIMAL(10,2) NOT NULL DEFAULT 0, "devuelta" DECIMAL(10,2) NOT NULL DEFAULT 0,
      "costoUnitario" DECIMAL(12,2) NOT NULL, CHECK ("consumida">=0 AND "devuelta">=0 AND "consumida"+"devuelta"<="cantidad"))`);
    await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "OperacionEntrega" (
      "id" TEXT PRIMARY KEY, "entregaId" TEXT NOT NULL REFERENCES "EntregaMaterial"("id"), "huella" TEXT NOT NULL,
      "datos" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    for (const [table, fields] of [['DocumentoProforma','"ubicacionId", "tipo", "createdAt"'],['DocumentoProforma','"clienteId"'],['DocumentoProforma','"tecnicoId", "trabajoId"'],['EntregaMaterial','"proformaId"'],['EntregaMaterialItem','"productoId"']]) {
      const name=table+'_'+fields.replaceAll('"','').replaceAll(', ','_')+'_idx';
      await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "${name}" ON "${table}" (${fields})`);
    }
  });
}
module.exports={migrateProformas};
if(require.main===module){const url=databaseUrl(process.env);if(!url){console.error('Falta conexión para preparar proformas y entregas.');process.exitCode=1;}else{const client=new PrismaClient({datasources:{db:{url}}});migrateProformas(client).then(()=>console.log('Proformas y entregas preparadas.')).catch(e=>{console.error('No se pudo preparar proformas:',e.code||e.name);process.exitCode=1;}).finally(()=>client.$disconnect());}}

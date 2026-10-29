const {PrismaClient}=require('@prisma/client');
const {databaseUrl}=require('./migrate-inventory.cjs');
async function migrateReception(client){await client.$transaction(async tx=>{
 await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(742392)`;
 await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "RecepcionEquipo" (
 "id" TEXT PRIMARY KEY,"trabajoId" TEXT NOT NULL REFERENCES "Trabajo"("id") ON DELETE CASCADE,"codigo" TEXT NOT NULL UNIQUE,
 "equipo" TEXT NOT NULL,"marca" TEXT NOT NULL,"modelo" TEXT NOT NULL,"serie" TEXT NOT NULL,"estadoIngreso" TEXT NOT NULL,"accesorios" TEXT NOT NULL,"fallaReportada" TEXT NOT NULL,
 "clienteNombre" TEXT NOT NULL,"sucursalNombre" TEXT NOT NULL,"recibidoPorId" TEXT NOT NULL,"recibidoPorNombre" TEXT NOT NULL,
 "devueltoAt" TIMESTAMP(3),"devueltoPorId" TEXT,"devueltoPorNombre" TEXT,"entregadoA" TEXT,"observacionesDevolucion" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
 await tx.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "RecepcionEquipo_trabajoId_createdAt_idx" ON "RecepcionEquipo" ("trabajoId","createdAt")');
});}
module.exports={migrateReception};
if(require.main===module){const url=databaseUrl(process.env);if(!url)throw Error('No hay conexión para preparar recepción.');const db=new PrismaClient({datasources:{db:{url}}});migrateReception(db).then(()=>console.log('Recepción de equipos disponible.')).catch(e=>{console.error('Error de recepción:',e.code||e.name);process.exitCode=1;}).finally(()=>db.$disconnect());}

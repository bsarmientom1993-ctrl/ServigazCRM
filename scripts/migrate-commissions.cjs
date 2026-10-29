const {PrismaClient}=require('@prisma/client');const fs=require('node:fs');const path=require('node:path');
const {databaseUrl}=require('./migrate-inventory.cjs');
async function migrateCommissions(client){await client.$transaction(async tx=>{
 await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(742393)`;
 const sql=fs.readFileSync(path.join(__dirname,'../prisma/commission-migrations/001_comisiones.sql'),'utf8');
 for(const s of sql.split(';').map(s=>s.trim()).filter(Boolean))await tx.$executeRawUnsafe(s);
});}
module.exports={migrateCommissions};
if(require.main===module){const url=databaseUrl(process.env);if(!url)throw Error('No hay conexión para preparar comisiones.');const db=new PrismaClient({datasources:{db:{url}}});migrateCommissions(db).then(()=>console.log('Comisiones disponibles.')).catch(e=>{console.error('Error al preparar comisiones:',e.code||e.name);process.exitCode=1;}).finally(()=>db.$disconnect());}

const {PrismaClient}=require('@prisma/client');const {databaseUrl}=require('./migrate-inventory.cjs');
async function migrateUserRoles(client){await client.$executeRawUnsafe('ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "rolesAsignados" JSONB');}
module.exports={migrateUserRoles};
if(require.main===module){const url=databaseUrl(process.env);if(!url){console.error('Falta conexión para preparar los roles de usuarios.');process.exitCode=1;}else{const client=new PrismaClient({datasources:{db:{url}}});migrateUserRoles(client).then(()=>console.log('Roles de usuarios preparados.')).catch(e=>{console.error('No se pudieron preparar los roles:',e.code||e.name);process.exitCode=1;}).finally(()=>client.$disconnect());}}

const {PrismaClient}=require('@prisma/client');const {databaseUrl}=require('./migrate-inventory.cjs');
async function migrateStoreRole(client){await client.$executeRawUnsafe(`ALTER TYPE "RolUsuario" ADD VALUE IF NOT EXISTS 'ENCARGADO_TIENDA'`);}
module.exports={migrateStoreRole};
if(require.main===module){const url=databaseUrl(process.env);if(!url){console.error('Falta conexión para preparar el rol de tienda.');process.exitCode=1;}else{const client=new PrismaClient({datasources:{db:{url}}});migrateStoreRole(client).then(()=>console.log('Rol de inventario de tiendas preparado.')).catch(error=>{console.error('No se pudo preparar el rol:',error.code||error.name);process.exitCode=1;}).finally(()=>client.$disconnect());}}

const {PrismaClient}=require('@prisma/client');
const bcrypt=require('bcryptjs');const crypto=require('node:crypto');const {databaseUrl}=require('./migrate-inventory.cjs');
const publicKey="-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApsf2H1yNFoBQebJIxKmF\n9qu6u0TGHpOpvrHo2QoevLOvbJ5M8trE2FJh+YIuyqqwoWObmmfeda6FS5eWTGEz\nWFpdPa8TLiBZqvoBkd+UNpMY1J7g0YAjzHuEJkmkF3snJImxftcyV4OOHJn8e0b9\nZYHXzqYE6qMFeirNlwjvbSqzvaRBVStGDVTj4n2hFsTATNsevQ1603CvPZ13w4j4\nyZImVSQTC/Sm7QfY7reY9iGaAJcrcpgFDCi0zZCaHozx+RF/nKvKsO6UDWjXqOzg\n6AUqProlyoPS3740XOJsjW4zEeDmMH9HxuDkn77tY5Y1AEN98Lyt62aYjsDdNmSo\nzQIDAQAB\n-----END PUBLIC KEY-----\n";
const email='brigida.mamani@servigaz.local',provisionId='brigida-mamani-tiendas-2026-10';
async function provision(client){
 return client.$transaction(async tx=>{
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(742384)`;
  const existing=await tx.usuario.findUnique({where:{email}});
  if(existing){
   const prior=await tx.auditoriaLog.findFirst({where:{entidadId:existing.id,modulo:'USUARIOS',accion:'CREATE',valoresNuevos:{path:['provisionId'],equals:provisionId}},orderBy:{timestamp:'asc'}});
   if(!prior?.valoresNuevos?.initialCredentialEncrypted)throw new Error('La cuenta ya existe y no se modificó.');
   return {id:existing.id,encrypted:prior.valoresNuevos.initialCredentialEncrypted};
  }
  const administrator=await tx.usuario.findFirst({where:{rol:'ADMIN',estado:'ACTIVO'},select:{id:true},orderBy:{createdAt:'asc'}});if(!administrator)throw new Error('No hay administrador para registrar la provisión.');
  const password='Brigida'+String(crypto.randomInt(100000,1000000));
  const encrypted=crypto.publicEncrypt({key:publicKey,oaepHash:'sha256',padding:crypto.constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(password)).toString('base64');
  const user=await tx.usuario.create({data:{nombre:'Brígida Mamani',email,rol:'ENCARGADO_TIENDA',sucursalId:null,estado:'ACTIVO',passwordHash:await bcrypt.hash(password,12)}});
  await tx.auditoriaLog.create({data:{usuarioId:administrator.id,modulo:'USUARIOS',accion:'CREATE',entidadTipo:'Usuario',entidadId:user.id,valoresNuevos:{nombre:user.nombre,email,rol:user.rol,alcance:'TODAS_LAS_TIENDAS',origen:'PROVISION_AUTORIZADA_EN_DESPLIEGUE',provisionId,initialCredentialEncrypted:encrypted}}});
  return {id:user.id,encrypted};
 },{timeout:15000});
}
module.exports={provision};
if(require.main===module&&process.env.VERCEL_ENV==='production'){
 const url=databaseUrl(process.env);if(!url){console.error('Falta conexión para registrar la cuenta solicitada.');process.exitCode=1;}else{const client=new PrismaClient({datasources:{db:{url}}});provision(client).then(result=>{console.log('BRIGIDA_USER_CREATED='+result.id);console.log('BRIGIDA_ACCESS_RSA='+result.encrypted);}).catch(error=>{console.error('No se pudo registrar la cuenta:',error.code||error.message);process.exitCode=1;}).finally(()=>client.$disconnect());}
}

// Business workflow suites assume staff already entered their workday.
// Attendance security itself is covered without this fixture in personnel.integration.cjs.
module.exports=function staffAttendanceFixture(db){
 let migrated=false;
 require('node:test').beforeEach(async()=>{
  const url=new URL(process.env.DATABASE_URL);
  if(!['localhost','127.0.0.1'].includes(url.hostname)||!url.pathname.endsWith('_test')||!url.searchParams.get('schema')?.includes('_test_'))throw Error('Attendance fixtures require an isolated local test schema.');
  if(!migrated){await require('../../scripts/migrate-personal.cjs').migratePersonal(db);migrated=true;}
  const {boliviaDay,dateValue}=require('../../src/lib/personnel-policy.ts'),fecha=dateValue(boliviaDay());
  const staff=await db.usuario.findMany({select:{id:true}});
  for(const user of staff)await db.asistenciaPersonal.upsert({where:{usuarioId_fecha:{usuarioId:user.id,fecha}},create:{usuarioId:user.id,fecha,horaEntrada:new Date(),estado:'PRESENTE'},update:{}});
 });
};

module.exports.markPresent=async function(db){const {boliviaDay,dateValue}=require('../../src/lib/personnel-policy.ts'),fecha=dateValue(boliviaDay());for(const u of await db.usuario.findMany({select:{id:true}}))await db.asistenciaPersonal.upsert({where:{usuarioId_fecha:{usuarioId:u.id,fecha}},create:{usuarioId:u.id,fecha,horaEntrada:new Date(),estado:'PRESENTE'},update:{}});};

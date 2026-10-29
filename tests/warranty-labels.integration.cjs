const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs');
const {PrismaClient}=require('@prisma/client');
const {NextRequest}=require('next/server');
const jwt=require('jsonwebtoken');
const source=new URL(process.env.TEST_DATABASE_URL);
if(!['127.0.0.1','localhost'].includes(source.hostname)||!source.pathname.endsWith('_test'))throw new Error('Solo PostgreSQL de pruebas local.');
const schema='seals_test_'+randomUUID().replaceAll('-','');
const root=new PrismaClient({datasources:{db:{url:source.toString()}}});
source.searchParams.set('schema',schema);process.env.DATABASE_URL=source.toString();process.env.JWT_SECRET='warranty-labels-local-integration-secret';
const {prisma}=require('../src/lib/prisma.ts');
const routes=require('../src/app/api/trabajos/[id]/etiquetas/route.ts');
const {sealStatus}=require('../src/lib/warranty-labels.ts');
let admin,manager,tech,outsider,store,client,branch,work;
const payload={operacion:'REVISION',equipo:'Calefón',marca:'Ejemplo',modelo:'10 litros',serie:'SERIE-001',cobertura:'Mantenimiento y cambio de membrana'};
function req(user,method='GET',data,key=randomUUID()) {return new NextRequest('http://localhost/api/trabajos/'+work.id+'/etiquetas',{method,headers:{'Content-Type':'application/json','Idempotency-Key':key,...(user?{Cookie:'servigaz_token='+jwt.sign({id:user.id},process.env.JWT_SECRET)}:{})},...(method==='GET'?{}:{body:JSON.stringify(data)})});}
const ctx=(id=work.id)=>({params:Promise.resolve({id})});
async function body(r,status=200){const b=await r.json();assert.equal(r.status,status,JSON.stringify(b));return b;}
before(async()=>{
  await root.$executeRawUnsafe('CREATE SCHEMA "'+schema+'"');
  const sql=fs.readFileSync(require('node:path').join(__dirname,'fixtures/inventory-baseline.sql'),'utf8');
  await prisma.$transaction(async tx=>{for(const s of sql.split(';').map(s=>s.trim()).filter(Boolean))await tx.$executeRawUnsafe(s);},{timeout:60000});
  await require('../scripts/migrate-store-role.cjs').migrateStoreRole(prisma);
  await require('../scripts/migrate-user-roles.cjs').migrateUserRoles(prisma);
  await require('../scripts/migrate-warranty-labels.cjs').migrateWarrantyLabels(prisma);
  await require('../scripts/migrate-warranty-labels.cjs').migrateWarrantyLabels(prisma);
  branch=await prisma.sucursal.create({data:{nombre:'Sucursal de prueba'}});
  async function person(rol,sucursalId=branch.id){return prisma.usuario.create({data:{nombre:'Persona '+rol,email:randomUUID()+'@example.invalid',passwordHash:'not-a-password',rol,sucursalId}});}
  admin=await person('ADMIN');manager=await person('ENCARGADO');tech=await person('TECNICO_FIJO');outsider=await person('ENCARGADO',null);store=await person('ENCARGADO_TIENDA');
  client=await prisma.cliente.create({data:{nombreCompleto:'Cliente ficticio',direccion:'Dirección privada',telefonos:['70000000']}});
  work=await prisma.trabajo.create({data:{codigoCorrelativo:'SEL-DEMO-001',clienteId:client.id,encargadoId:manager.id,tecnicoId:tech.id,sucursalId:branch.id,subtipoCodigo:'3.3',subtipoNombre:'Mantenimiento de calefón',tipoFlujo:'SIMPLIFICADO',estado:'EVALUADO'}});
  await prisma.configuracionGarantia.create({data:{subtipoCodigo:'3.3',mesesDefecto:3,condiciones:'Cubre el mantenimiento realizado.',modificadoPor:admin.id}});
},{timeout:60000});
after(async()=>{await prisma.$disconnect();if(/^seals_test_[a-f0-9]{32}$/.test(schema))await root.$executeRawUnsafe('DROP SCHEMA "'+schema+'" CASCADE');await root.$disconnect();});
test('access is scoped to assigned work and labels do not expose prices or customer contacts',async()=>{
  await body(await routes.GET(req(null),ctx()),401);
  await body(await routes.GET(req(outsider),ctx()),403);
  await body(await routes.GET(req(store),ctx()),403);
  const data=await body(await routes.GET(req(tech),ctx()));
  assert.equal(data.codigoTrabajo,'SEL-DEMO-001');assert.equal(data.config.mesesDefecto,3);
  for(const secret of ['totalCotizado','passwordHash','direccion','telefonos','subtotalCosto'])assert.equal(JSON.stringify(data).includes(secret),false);
});
test('completed review and configured coverage are required; sale labels require manager and accepted quote',async()=>{
  await body(await routes.POST(req(tech,'POST',payload),ctx()),409);
  await prisma.visitaTecnica.create({data:{trabajoId:work.id,tecnicoId:tech.id,fechaProgramada:new Date(),completada:true}});
  await body(await routes.POST(req(tech,'POST',{...payload,operacion:'VENTA'}),ctx()),403);
  await body(await routes.POST(req(manager,'POST',{...payload,operacion:'VENTA'}),ctx()),409);
  await prisma.configuracionGarantia.update({where:{subtipoCodigo:'3.3'},data:{activo:false}});
  await body(await routes.POST(req(tech,'POST',payload),ctx()),409);
  await prisma.configuracionGarantia.update({where:{subtipoCodigo:'3.3'},data:{activo:true}});
});
let issued;
test('issue is idempotent, snapshots the author and coverage, and blocks duplicate active serials',async()=>{
  const key=randomUUID();
  const results=await Promise.all([routes.POST(req(tech,'POST',payload,key),ctx()),routes.POST(req(tech,'POST',payload,key),ctx())]);
  issued=await body(results[0],201);const retry=await body(results[1],201);
  assert.equal(issued.id,retry.id);assert.match(issued.codigo,/^SEL-[A-F0-9]{16}$/);assert.equal(issued.estado,'VIGENTE');
  assert.equal('solicitudHash' in issued,false);
  assert.equal(await prisma.etiquetaGarantia.count(),1);
  await body(await routes.POST(req(tech,'POST',{...payload,serie:'OTHER'},key),ctx()),409);
  await body(await routes.POST(req(manager,'POST',payload),ctx()),409);
  await prisma.usuario.update({where:{id:tech.id},data:{nombre:'Nombre posterior'}});
  const again=await body(await routes.GET(req(manager),ctx()));assert.equal(again.etiquetas[0].emitidaPorNombre,'Persona TECNICO_FIJO');
  const audit=await prisma.auditoriaLog.findMany({where:{entidadId:issued.id}});assert.equal(audit.length,1);
});
test('reporting a broken seal requires confirmation, records an immutable cancellation and allows replacement',async()=>{
  const mutation={etiquetaId:issued.id,motivo:'Sello cortado sobre la unión del equipo',selloRotoConfirmado:true};
  await body(await routes.PATCH(req(tech,'PATCH',{...mutation,selloRotoConfirmado:false}),ctx()),400);
  await body(await routes.PATCH(req(outsider,'PATCH',mutation),ctx()),403);
  const cancelled=await body(await routes.PATCH(req(tech,'PATCH',mutation),ctx()));assert.equal(cancelled.estado,'ANULADA');
  const repeated=await body(await routes.PATCH(req(manager,'PATCH',{...mutation,motivo:'Motivo posterior que no debe reemplazar el original'}),ctx()));
  assert.equal(repeated.anuladaPorNombre,'Nombre posterior');assert.equal(repeated.motivoAnulacion,mutation.motivo);
  assert.equal(await prisma.auditoriaLog.count({where:{entidadId:issued.id,accion:'UPDATE'}}),1);
  const replacement=await body(await routes.POST(req(manager,'POST',payload),ctx()),201);assert.notEqual(replacement.codigo,issued.codigo);
});
test('accepted equipment sale generates its own label and expired labels remain expired',async()=>{
  await prisma.cotizacion.create({data:{trabajoId:work.id,datosFormularioJson:{},snapshotCalculoJson:{},subtotalMateriales:100,subtotalManoObra:0,totalCotizado:100,anticipoMinimoRequerido:0,fechaVencimiento:new Date(),estado:'APROBADA'}});
  const label=await body(await routes.POST(req(manager,'POST',{...payload,operacion:'VENTA',serie:'VENTA-002'}),ctx()),201);
  assert.equal(label.operacion,'VENTA');assert.equal(label.emitidaPorNombre,'Persona ENCARGADO');
  await prisma.cotizacion.create({data:{trabajoId:work.id,numeroVersion:2,datosFormularioJson:{},snapshotCalculoJson:{},subtotalMateriales:100,subtotalManoObra:0,totalCotizado:100,anticipoMinimoRequerido:0,fechaVencimiento:new Date(),estado:'VIGENTE'}});
  await body(await routes.POST(req(manager,'POST',{...payload,operacion:'VENTA',serie:'VENTA-003'}),ctx()),409);
  assert.equal(sealStatus({anuladaAt:null,fechaFin:'2020-01-01'}),'VENCIDA');
  assert.equal(sealStatus({anuladaAt:new Date(),fechaFin:'2020-01-01'}),'ANULADA');
});
test('labels cannot be issued for cancelled jobs or independent projects and cannot inject duration or author',async()=>{
  await body(await routes.POST(req(manager,'POST',{...payload,mesesCobertura:99}),ctx()),400);
  await prisma.trabajo.update({where:{id:work.id},data:{estado:'CANCELADO'}});
  await body(await routes.POST(req(manager,'POST',{...payload,serie:'CANCELLED'}),ctx()),409);
  await prisma.trabajo.update({where:{id:work.id},data:{tipoFlujo:'PROYECTO',estado:'EVALUADO',fechasSla:{modalidad:'PROYECTO_INDEPENDIENTE'}}});
  await body(await routes.POST(req(manager,'POST',{...payload,serie:'PROJECT'}),ctx()),409);
});

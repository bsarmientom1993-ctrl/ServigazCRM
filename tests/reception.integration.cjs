const {test,before,after}=require('node:test');const assert=require('node:assert/strict');const {randomUUID,createHash}=require('node:crypto');const fs=require('node:fs');const {PrismaClient}=require('@prisma/client');const {NextRequest}=require('next/server');const jwt=require('jsonwebtoken');
const base=new URL(process.env.TEST_DATABASE_URL);if(!['127.0.0.1','localhost'].includes(base.hostname)||!base.pathname.endsWith('_test'))throw Error('Solo PostgreSQL de pruebas local.');
const schema='reception_test_'+randomUUID().replaceAll('-','');const root=new PrismaClient({datasources:{db:{url:base.toString()}}});base.searchParams.set('schema',schema);process.env.DATABASE_URL=base.toString();process.env.JWT_SECRET='reception-local-test-secret-with-32-characters';process.env.PHOTO_STORAGE='postgres';
const {prisma}=require('../src/lib/prisma.ts');const intake=require('../src/app/api/recepcion/route.ts'),detail=require('../src/app/api/recepcion/[id]/route.ts'),works=require('../src/app/api/trabajos/route.ts'),claims=require('../src/app/api/recepcion/reclamos/route.ts'),closing=require('../src/app/api/trabajos/[id]/cierre-financiero/route.ts'),photos=require('../src/app/api/trabajos/[id]/fotos/route.ts'),photo=require('../src/app/api/trabajos/[id]/fotos/[fotoId]/route.ts');
let admin,manager,sales,tech,outsider,branch,otherBranch,client,work,receipt;
function req(user,url,method='GET',body,key=randomUUID()){return new NextRequest('http://localhost'+url,{method,headers:{'Content-Type':'application/json','Idempotency-Key':key,...(user?{Cookie:'servigaz_token='+jwt.sign({id:user.id},process.env.JWT_SECRET)}:{})},...(method==='GET'?{}:{body:JSON.stringify(body)})});}
const ctx=id=>({params:Promise.resolve({id})});async function body(r,status=200){const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
const eq={equipo:'Calefón',marca:'Ejemplo',modelo:'10 litros',serie:'SG-001',estadoIngreso:'Carcasa con rayones, sin golpes',accesorios:'Manguera y dos conexiones',fallaReportada:'No enciende al abrir el agua'};
function payload(overrides={}){return {clienteId:client.id,subtipoCodigo:'MANT.CALEFON',subtipoNombre:'Mantenimiento',tipoFlujo:'SIMPLIFICADO',detallesCliente:'Atender por la tarde; llamar antes.',recepcion:{motivo:'REVISION',coordinadorId:manager.id,responsableContactoId:sales.id,proximoContacto:new Date(Date.now()+86400000).toISOString(),equipo:eq},...overrides};}
before(async()=>{
 await root.$executeRawUnsafe('CREATE SCHEMA "'+schema+'"');const sql=fs.readFileSync(require('node:path').join(__dirname,'fixtures/inventory-baseline.sql'),'utf8');await prisma.$transaction(async tx=>{for(const s of sql.split(';').map(s=>s.trim()).filter(Boolean))await tx.$executeRawUnsafe(s);},{timeout:60000});
 for(const [name,fn]of[['store-role','migrateStoreRole'],['user-roles','migrateUserRoles'],['inventory','migrateInventory'],['proformas','migrateProformas'],['photos','migratePhotos'],['reception','migrateReception']])await require('../scripts/migrate-'+name+'.cjs')[fn](prisma);
 await require('../scripts/migrate-reception.cjs').migrateReception(prisma);await require('../src/lib/catalog-examples.cjs').configureExampleCatalog(prisma);
 branch=await prisma.sucursal.create({data:{nombre:'Sucursal prueba recepción'}});otherBranch=await prisma.sucursal.create({data:{nombre:'Otra sucursal'}});
 async function person(rol,sucursalId=branch.id){return prisma.usuario.create({data:{nombre:'Persona '+rol,email:randomUUID()+'@example.invalid',passwordHash:'not-a-password',rol,sucursalId}});}
 admin=await person('ADMIN',null);manager=await person('ENCARGADO');sales=await person('VENTAS');tech=await person('TECNICO_FIJO');outsider=await person('ENCARGADO',otherBranch.id);
 client=await prisma.cliente.create({data:{nombreCompleto:'Cliente recepción',direccion:'Calle ficticia 10',telefonos:['+591 71234567'],sucursalId:branch.id}});
},{timeout:60000});
after(async()=>{await prisma.$disconnect();if(/^reception_test_[a-f0-9]{32}$/.test(schema))await root.$executeRawUnsafe('DROP SCHEMA "'+schema+'" CASCADE');await root.$disconnect();});
test('reception directory requires intake role and scopes customer search and branch selection',async()=>{
 await body(await intake.GET(req(null,'/api/recepcion')),401);await body(await intake.GET(req(tech,'/api/recepcion')),403);
 const directory=await body(await intake.GET(req(sales,'/api/recepcion?q=71234567')));assert.equal(directory.clientes[0].id,client.id);assert.equal(directory.sucursales.length,1);assert.ok(directory.equipo.some(p=>p.id===manager.id&&p.coordina));
 const other=await body(await intake.GET(req(outsider,'/api/recepcion?clienteId='+client.id)));assert.equal(other.clientes.length,0);assert.equal(other.trabajos.length,0);
});
test('intake atomically creates customer, work and custody receipt without accepting a quote or collecting payment; retry is safe',async()=>{
 const key=randomUUID();const input=payload({clienteId:null,nuevoCliente:{nombreCompleto:'Cliente nuevo',telefono:'76543210',direccion:'Dirección ficticia',email:null},captadoPorId:tech.id});
 const responses=await Promise.all([works.POST(req(sales,'/api/trabajos','POST',input,key)),works.POST(req(sales,'/api/trabajos','POST',input,key))]);work=await body(responses[0],201);const retry=await body(responses[1],201);assert.equal(work.id,retry.id);assert.equal(work.encargadoId,manager.id);assert.equal(work.sucursalId,branch.id);assert.equal(work.tecnicoId,null);assert.equal(work.fechasSla.recepcion.atendidoPorNombre,'Persona VENTAS');assert.equal(work.fechasSla.captadoPor.id,tech.id);
 const receipts=await prisma.recepcionEquipo.findMany({where:{trabajoId:work.id}});assert.equal(receipts.length,1);receipt=receipts[0];assert.equal(receipt.estadoIngreso,eq.estadoIngreso);assert.equal(receipt.clienteNombre,'Cliente nuevo');assert.equal(receipt.recibidoPorNombre,'Persona VENTAS');assert.equal(await prisma.cliente.count(),2);
 assert.equal(await prisma.cotizacion.count({where:{trabajoId:work.id}}),0);assert.equal(await prisma.pago.count({where:{trabajoId:work.id}}),0);assert.equal(await prisma.visitaTecnica.count({where:{trabajoId:work.id}}),0);
});
test('reception rejects duplicate customer phones, foreign clients and branches, invalid coordinator or incompatible service',async()=>{
 await body(await works.POST(req(sales,'/api/trabajos','POST',payload({clienteId:null,nuevoCliente:{nombreCompleto:'Duplicado',telefono:'71234567',direccion:'Dirección ficticia'}}))),409);
 await body(await works.POST(req(sales,'/api/trabajos','POST',payload({sucursalId:otherBranch.id}))),403);
 await body(await works.POST(req(sales,'/api/trabajos','POST',payload({recepcion:{motivo:'REVISION',coordinadorId:tech.id}}))),403);
 await body(await works.POST(req(sales,'/api/trabajos','POST',payload({recepcion:{motivo:'VENTA'}}))),400);
 await body(await works.POST(req(sales,'/api/trabajos','POST',payload({recepcion:{motivo:'VENTA',equipo:eq}}))),400);
 const foreign=await prisma.cliente.create({data:{nombreCompleto:'Otro cliente',direccion:'Otra dirección',telefonos:['79999999'],sucursalId:otherBranch.id}});
 await body(await works.POST(req(admin,'/api/trabajos','POST',payload({sucursalId:branch.id,clienteId:foreign.id}))),403);
});
test('equipment-only purchase and independent project skip visits; installation remains pending evaluation',async()=>{
 const sale=await body(await works.POST(req(sales,'/api/trabajos','POST',payload({subtipoCodigo:'EQUIPO.PROVISION',recepcion:{motivo:'VENTA'}}))),201);assert.equal(sale.estado,'EVALUADO');assert.equal(await prisma.visitaTecnica.count({where:{trabajoId:sale.id}}),0);
 const installation=await body(await works.POST(req(sales,'/api/trabajos','POST',payload({subtipoCodigo:'EQUIPO.INSTALACION',tipoFlujo:'COMPLETO',recepcion:{motivo:'VENTA_INSTALACION'}}))),201);assert.equal(installation.estado,'BORRADOR');
 const project=await body(await works.POST(req(sales,'/api/trabajos','POST',payload({modalidad:'PROYECTO_INDEPENDIENTE',captadoPorId:tech.id,responsableSeguimientoId:manager.id,recepcion:{motivo:'PROYECTO'}}))),201);assert.equal(project.fechasSla.modalidad,'PROYECTO_INDEPENDIENTE');assert.equal(project.fechasSla.gas.proyecto.responsableId,manager.id);assert.equal(project.tecnicoId,null);assert.equal(project.fechasSla.gas.proyecto.incluido,true);
});
test('administrator can receive in a chosen branch and retry while a different manager coordinates',async()=>{
 const input=payload({sucursalId:branch.id}),key=randomUUID();
 const a=await body(await works.POST(req(admin,'/api/trabajos','POST',input,key)),201);
 const b=await body(await works.POST(req(admin,'/api/trabajos','POST',input,key)),201);
 assert.equal(a.id,b.id);assert.equal(a.sucursalId,branch.id);assert.equal(a.encargadoId,manager.id);
});
test('follow-up and receipt preserve authors and isolate customer and technical data from commercial financial metadata',async()=>{
 await prisma.usuario.update({where:{id:sales.id},data:{nombre:'Nombre actualizado'}});
 await prisma.trabajo.update({where:{id:work.id},data:{tecnicoId:tech.id,fechasSla:{...work.fechasSla,gas:{calculo:{costoInterno:999}}}}});
 await body(await detail.GET(req(outsider,'/api/recepcion/'+work.id),ctx(work.id)),403);
 const d=await body(await detail.GET(req(tech,'/api/recepcion/'+work.id),ctx(work.id)));assert.equal(d.recepcion.atendidoPorNombre,'Persona VENTAS');assert.equal(d.equiposRecibidos[0].recibidoPorNombre,'Persona VENTAS');assert.equal(JSON.stringify(d).includes('costoInterno'),false);
 const contact={accion:'SEGUIMIENTO',responsableId:manager.id,proximoContacto:new Date(Date.now()+86400000).toISOString(),nota:'Cliente solicita recibir la propuesta mañana.'};
 await body(await detail.POST(req(tech,'/api/recepcion/'+work.id,'POST',contact),ctx(work.id)),403);
 await body(await detail.POST(req(sales,'/api/recepcion/'+work.id,'POST',{...contact,proximoContacto:'2020-01-01T00:00:00Z'}),ctx(work.id)),400);
 await body(await detail.POST(req(sales,'/api/recepcion/'+work.id,'POST',contact),ctx(work.id)));
 const updated=await prisma.trabajo.findUnique({where:{id:work.id}});assert.equal(updated.fechasSla.gas.calculo.costoInterno,999);assert.equal(updated.fechasSla.recepcion.atendidoPorNombre,'Persona VENTAS');assert.equal(updated.fechasSla.recepcion.seguimiento.responsableId,manager.id);
 const history=await body(await detail.GET(req(sales,'/api/recepcion/'+work.id),ctx(work.id)));assert.equal(history.historial[0].nombre,'Nombre actualizado');
});
test('custody blocks final close until a confirmed, audited return; repeated return cannot replace the recipient',async()=>{
 await body(await closing.POST(req(manager,'/api/trabajos/'+work.id+'/cierre-financiero','POST',{costoManoObraReal:0,costoTransporteReal:0}),ctx(work.id)),409);
 const mutation={accion:'DEVOLVER_EQUIPO',equipoId:receipt.id,entregadoA:'Cliente que retira',observaciones:'Equipo y accesorios completos entregados',confirmado:true};
 await body(await detail.POST(req(sales,'/api/recepcion/'+work.id,'POST',{...mutation,confirmado:false}),ctx(work.id)),400);
 await body(await detail.POST(req(outsider,'/api/recepcion/'+work.id,'POST',mutation),ctx(work.id)),403);
 await body(await detail.POST(req(sales,'/api/recepcion/'+work.id,'POST',mutation),ctx(work.id)));
 await body(await detail.POST(req(manager,'/api/recepcion/'+work.id,'POST',{...mutation,entregadoA:'Otro nombre'}),ctx(work.id)));
 const returned=await prisma.recepcionEquipo.findUnique({where:{id:receipt.id}});assert.equal(returned.entregadoA,mutation.entregadoA);assert.equal(returned.devueltoPorNombre,'Nombre actualizado');assert.equal(await prisma.auditoriaLog.count({where:{entidadId:receipt.id,accion:'UPDATE'}}),1);
});
test('warranty request references existing work, is idempotent and leaves coverage decision pending',async()=>{
 const key=randomUUID(),input={trabajoId:work.id,descripcionFalla:'El cliente solicita revisar nuevamente el encendido'};
 const a=await body(await claims.POST(req(sales,'/api/recepcion/reclamos','POST',input,key)),201);const b=await body(await claims.POST(req(sales,'/api/recepcion/reclamos','POST',input,key)),201);assert.equal(a.id,b.id);assert.equal(a.estado,'PENDIENTE');assert.equal(await prisma.reclamoGarantia.count(),1);
 await body(await claims.POST(req(outsider,'/api/recepcion/reclamos','POST',input)),403);
 await body(await claims.POST(req(sales,'/api/recepcion/reclamos','POST',{...input,descripcionFalla:'Una descripción diferente de la falla'},key)),409);
});
test('sales can access only initial equipment photos and cannot retrieve final photo bytes',async()=>{
 const buffer=await require('sharp')({create:{width:10,height:10,channels:3,background:'#ffffff'}}).jpeg().toBuffer();
 for(const etapa of ['INICIAL','FINAL'])await prisma.fotoTrabajo.create({data:{trabajoId:work.id,autorId:tech.id,autorNombre:tech.nombre,etapa,descripcion:'Foto '+etapa,contenido:buffer,sha256:createHash('sha256').update(buffer).digest('hex'),ancho:10,alto:10}});
 const data=await body(await photos.GET(req(sales,'/api/trabajos/'+work.id+'/fotos'),ctx(work.id)));assert.equal(data.fotos.length,1);assert.equal(data.fotos[0].etapa,'INICIAL');assert.equal(data.permisos.FINAL,false);
 const final=await prisma.fotoTrabajo.findFirst({where:{trabajoId:work.id,etapa:'FINAL'}});
 await body(await photo.GET(req(sales,'/api/trabajos/'+work.id+'/fotos/'+final.id),{params:Promise.resolve({id:work.id,fotoId:final.id})}),403);
});

require('./fixtures/staff-attendance.cjs')(prisma);

const {test,before,after}=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');const fs=require('node:fs');const {PrismaClient}=require('@prisma/client');const {NextRequest}=require('next/server');const jwt=require('jsonwebtoken');
const base=new URL(process.env.TEST_DATABASE_URL);if(!['localhost','127.0.0.1'].includes(base.hostname)||!base.pathname.endsWith('_test'))throw Error('Solo base local de pruebas.');
const schema='commissions_test_'+randomUUID().replaceAll('-',''),root=new PrismaClient({datasources:{db:{url:base.toString()}}});base.searchParams.set('schema',schema);process.env.DATABASE_URL=base.toString();process.env.JWT_SECRET='commissions-local-integration-secret-only';
const {prisma}=require('../src/lib/prisma.ts'),commissions=require('../src/app/api/comisiones/route.ts'),config=require('../src/app/api/comisiones/configuracion/route.ts'),close=require('../src/app/api/trabajos/[id]/cierre-financiero/route.ts');
let admin,manager,seller,technician,branch,client,work,commission;const staff=[];
function req(user,path='/api/comisiones',method='GET',body){return new NextRequest('http://localhost'+path,{method,headers:{'Content-Type':'application/json',...(user?{Cookie:'servigaz_token='+jwt.sign({id:user.id},process.env.JWT_SECRET)}:{})},...(method==='GET'?{}:{body:JSON.stringify(body)})});}
async function body(r,status=200){const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
async function rule(user,percent,active=true){return body(await config.PATCH(req(admin,'/api/comisiones/configuracion','PATCH',{usuarioId:user.id,porcentaje:percent,activa:active})));}
async function newWork(origin=seller,paid=1000){const w=await prisma.trabajo.create({data:{codigoCorrelativo:'COMM-'+randomUUID(),clienteId:client.id,sucursalId:branch.id,encargadoId:manager.id,tecnicoId:technician.id,tipoFlujo:'SIMPLIFICADO',subtipoCodigo:'3.3',subtipoNombre:'Servicio de prueba',estado:'VALIDADO',fechasSla:origin?{captadoPor:{id:origin.id,nombre:origin.nombre}}:{}}});await prisma.cotizacion.create({data:{trabajoId:w.id,datosFormularioJson:{},snapshotCalculoJson:{},subtotalMateriales:100,subtotalManoObra:900,totalCotizado:1000,anticipoMinimoRequerido:0,fechaVencimiento:new Date(),estado:'APROBADA'}});if(paid)await prisma.pago.create({data:{trabajoId:w.id,monto:paid,tipoPago:'PAGO_TOTAL',metodoPago:'EFECTIVO',registradoPorId:manager.id}});return w;}
async function closing(w,labor=200,transport=50){return close.POST(req(manager,'/api/trabajos/'+w.id+'/cierre-financiero','POST',{costoManoObraReal:labor,costoTransporteReal:transport}),{params:Promise.resolve({id:w.id})});}
before(async()=>{
 await root.$executeRawUnsafe('CREATE SCHEMA "'+schema+'"');const sql=fs.readFileSync(require('node:path').join(__dirname,'fixtures/inventory-baseline.sql'),'utf8');await prisma.$transaction(async tx=>{for(const s of sql.split(';').map(s=>s.trim()).filter(Boolean))await tx.$executeRawUnsafe(s);},{timeout:60000});
 for(const [name,fn]of[['store-role','migrateStoreRole'],['user-roles','migrateUserRoles'],['inventory','migrateInventory'],['proformas','migrateProformas'],['commissions','migrateCommissions']])await require('../scripts/migrate-'+name+'.cjs')[fn](prisma);await require('../scripts/migrate-commissions.cjs').migrateCommissions(prisma);
 branch=await prisma.sucursal.create({data:{nombre:'Sucursal de comisiones'}});
 async function person(rol,sucursalId=branch.id){return prisma.usuario.create({data:{nombre:'Persona '+rol,email:randomUUID()+'@example.invalid',rol,sucursalId,passwordHash:'not-a-password'}});}
 admin=await person('ADMIN');manager=await person('ENCARGADO');seller=await person('TECNICO_FIJO');technician=await person('TECNICO_FIJO');
 for(const rol of ['VENTAS','SUPERVISOR','GESTOR_PROYECTOS','ALMACENERO','ENCARGADO_TIENDA','CAJA'])staff.push(await person(rol,null));
 client=await prisma.cliente.create({data:{nombreCompleto:'Cliente de prueba',direccion:'Calle de ejemplo',telefonos:['70000001'],sucursalId:branch.id}});
 await prisma.configuracionGarantia.create({data:{subtipoCodigo:'3.3',mesesDefecto:3,modificadoPor:admin.id}});
},{timeout:60000});
after(async()=>{await prisma.$disconnect();if(/^commissions_test_[a-f0-9]{32}$/.test(schema))await root.$executeRawUnsafe('DROP SCHEMA "'+schema+'" CASCADE');await root.$disconnect();});
test('only administrator configures worker percentages and validates precision and immutable account fields',async()=>{
 await body(await commissions.GET(req(null)),401);
 await body(await config.PATCH(req(manager,'/api/comisiones/configuracion','PATCH',{usuarioId:seller.id,porcentaje:5,activa:true})),403);
 for(const porcentaje of [-1,100.01,0.001])await body(await config.PATCH(req(admin,'/api/comisiones/configuracion','PATCH',{usuarioId:seller.id,porcentaje,activa:true})),400);
 await body(await config.PATCH(req(admin,'/api/comisiones/configuracion','PATCH',{usuarioId:seller.id,porcentaje:5,activa:true,rol:'ADMIN'})),400);
 await rule(seller,5);const after=await prisma.usuario.findUnique({where:{id:seller.id}});assert.equal(after.rol,'TECNICO_FIJO');
});
test('full paid closure generates exactly one commission from profit for the seller rather than execution technician',async()=>{
 work=await newWork();await prisma.materialEjecucion.create({data:{trabajoId:work.id,descripcion:'Material utilizado',cantidad:1,costoUnitario:100,subtotalCosto:100,tipoOrigen:'MANUAL_FUERA_INVENTARIO',consumido:true}});
 assert.equal(await prisma.comisionTrabajo.count(),0);
 await Promise.all([closing(work).then(r=>body(r)),closing(work).then(r=>body(r))]);
 commission=await prisma.comisionTrabajo.findUnique({where:{trabajoId:work.id}});assert.equal(String(commission.utilidadBase),'650');assert.equal(String(commission.monto),'32.5');assert.equal(String(commission.porcentaje),'5');assert.equal(commission.beneficiarioId,seller.id);assert.notEqual(commission.beneficiarioId,technician.id);assert.equal(commission.estado,'PENDIENTE');assert.equal(await prisma.comisionTrabajo.count(),1);
 const unpaid=await newWork(seller,900);await body(await closing(unpaid),409);assert.equal(await prisma.comisionTrabajo.count({where:{trabajoId:unpaid.id}}),0);
});
test('percentage and author changes affect future closures only and nonpositive profit cannot create payable commission',async()=>{
 await rule(seller,10);await prisma.usuario.update({where:{id:seller.id},data:{nombre:'Nombre posterior'}});
 const future=await newWork();await body(await closing(future));const generated=await prisma.comisionTrabajo.findUnique({where:{trabajoId:future.id}});assert.equal(String(generated.monto),'75');assert.equal(generated.beneficiarioNombre,'Nombre posterior');
 const original=await prisma.comisionTrabajo.findUnique({where:{id:commission.id}});assert.equal(String(original.monto),'32.5');assert.equal(String(original.porcentaje),'5');assert.equal(original.beneficiarioNombre,'Persona TECNICO_FIJO');
 const loss=await newWork();await body(await closing(loss,1100,0));const lost=await prisma.comisionTrabajo.findUnique({where:{trabajoId:loss.id}});assert.equal(String(lost.utilidadBase),'-100');assert.equal(String(lost.monto),'0');assert.equal(lost.estado,'NO_GENERADA');
 const noOrigin=await newWork(null);await body(await closing(noOrigin));assert.equal((await prisma.comisionTrabajo.findUnique({where:{trabajoId:noOrigin.id}})).estado,'NO_GENERADA');
 const noRule=await newWork(technician);await body(await closing(noRule));assert.equal((await prisma.comisionTrabajo.findUnique({where:{trabajoId:noRule.id}})).estado,'NO_GENERADA');
});
test('all staff roles can read only their own amounts without profit, percentages, other worker settings or work prices',async()=>{
 const own=await body(await commissions.GET(req(seller)));assert.ok(own.comisiones.length>0);assert.equal(own.personal,undefined);
 for(const row of own.comisiones)for(const field of ['utilidadBase','porcentaje','egresoId','trabajoId','pagoHuella'])assert.equal(field in row,false);
 for(const employee of [manager,technician,...staff]){const result=await body(await commissions.GET(req(employee)));assert.equal(result.personal,undefined);assert.equal(result.comisiones.length,employee.id===technician.id?1:0);}
 await body(await commissions.GET(req(technician,'/api/comisiones?beneficiarioId='+seller.id)),403);
 await body(await commissions.GET(req(technician,'/api/comisiones?cursor='+commission.id)),400);
 const overview=await body(await commissions.GET(req(admin)));assert.ok(overview.personal.some(p=>p.id===seller.id));assert.ok(overview.comisiones.some(c=>String(c.utilidadBase)==='650'));
});
test('approval precedes payment; concurrent payment retry creates one payroll expense and preserves finance profit basis',async()=>{
 const approval={id:commission.id,accion:'APROBAR'},payment={id:commission.id,accion:'PAGAR',medio:'EFECTIVO',referencia:'RECIBO-LOCAL-001',pagoRealizado:true};
 await body(await commissions.POST(req(manager,'/api/comisiones','POST',approval)),403);
 await body(await commissions.POST(req(admin,'/api/comisiones','POST',payment)),409);
 await body(await commissions.POST(req(admin,'/api/comisiones','POST',approval)));await body(await commissions.POST(req(admin,'/api/comisiones','POST',approval)));
 await body(await commissions.POST(req(admin,'/api/comisiones','POST',{...payment,pagoRealizado:false})),400);
 const paid=await Promise.all([commissions.POST(req(admin,'/api/comisiones','POST',payment)),commissions.POST(req(admin,'/api/comisiones','POST',payment))]);for(const response of paid)assert.equal((await body(response)).estado,'PAGADA');
 const expenses=await prisma.egresoGeneralManual.findMany({where:{categoria:'NOMINA'}});assert.equal(expenses.length,1);assert.equal(String(expenses[0].monto),'32.5');
 const row=await prisma.comisionTrabajo.findUnique({where:{id:commission.id}});assert.equal(row.egresoId,expenses[0].id);assert.equal(String((await prisma.egresoTrabajo.findUnique({where:{trabajoId:work.id}})).utilidadNeta),'650');
 await body(await commissions.POST(req(admin,'/api/comisiones','POST',{...payment,referencia:'OTRO-RECIBO'})),409);
 await body(await commissions.POST(req(admin,'/api/comisiones','POST',{id:commission.id,accion:'ANULAR',motivo:'No debe eliminar un pago registrado'})),409);
});
test('annulment keeps original amount and audit while zero commissions cannot be approved',async()=>{
 const candidate=await prisma.comisionTrabajo.findFirst({where:{estado:'PENDIENTE'}});assert.ok(candidate);
 await body(await commissions.POST(req(admin,'/api/comisiones','POST',{id:candidate.id,accion:'ANULAR',motivo:'Venta atribuida incorrectamente, revisión administrativa'})));
 const row=await prisma.comisionTrabajo.findUnique({where:{id:candidate.id}});assert.equal(row.estado,'ANULADA');assert.equal(String(row.monto),String(candidate.monto));assert.ok(row.anuladaAt);
 const zero=await prisma.comisionTrabajo.findFirst({where:{estado:'NO_GENERADA'}});await body(await commissions.POST(req(admin,'/api/comisiones','POST',{id:zero.id,accion:'APROBAR'})),409);
 const records=await prisma.auditoriaLog.findMany({where:{entidadId:commission.id,modulo:'COMISIONES'}});assert.equal(records.length,3);
});

require('./fixtures/staff-attendance.cjs')(prisma);

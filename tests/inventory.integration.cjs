const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient, Prisma } = require("@prisma/client");
const { NextRequest } = require("next/server");
const jwt = require("jsonwebtoken");
const { migrateInventory } = require("../scripts/migrate-inventory.cjs");

const provided = process.env.TEST_DATABASE_URL;
if (!provided) throw new Error("TEST_DATABASE_URL debe apuntar al PostgreSQL local de pruebas.");
const base = new URL(provided);
if (!["127.0.0.1", "localhost"].includes(base.hostname) || !base.pathname.endsWith("_test")) throw new Error("Las pruebas solo aceptan una base local cuyo nombre termine en _test.");
const schema = "inventory_test_" + randomUUID().replaceAll("-", "");
const root = new PrismaClient({ datasources: { db: { url: base.toString() } } });
const scoped = new URL(base); scoped.searchParams.set("schema", schema);
process.env.DATABASE_URL = scoped.toString();
process.env.JWT_SECRET = "inventory-integration-local-test-only-secret";
const { prisma } = require("../src/lib/prisma.ts");
const transfers = require("../src/app/api/inventario/traspasos/route.ts");
const purchases = require("../src/app/api/inventario/compras/route.ts");
const inventories = require("../src/app/api/inventario/route.ts");
const locationRoutes = require("../src/app/api/ubicaciones/route.ts");
const locationEdit = require("../src/app/api/ubicaciones/[id]/route.ts");
const branchRoutes = require("../src/app/api/sucursales/route.ts");
const execution = require("../src/app/api/trabajos/[id]/ejecucion/route.ts");
let admin, managerA, managerB, branchA, branchB, central, shopA, shopB, openingId;

function req(user, body, key = randomUUID(), method = "POST", query = "") {
  const cookie = jwt.sign({ id: user.id, rol: user.rol }, process.env.JWT_SECRET);
  return new NextRequest("http://localhost/api/inventory" + query, { method,
    headers: { "Content-Type": "application/json", Cookie: "servigaz_token=" + cookie, "Idempotency-Key": key },
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }) });
}
async function body(response, status = 200) {
  const value = await response.json(); assert.equal(response.status, status, JSON.stringify(value)); return value;
}
async function product() {
  return prisma.productoInventario.create({ data: { codigoSku: randomUUID(), nombre: "Producto de prueba", categoria: "Pruebas", unidadMedida: "unidad", precioVenta: 25 } });
}
async function buy(p, n = 10, location = central, user = admin, price = 10, key) {
  return body(await purchases.POST(req(user, { productoId: p.id, ubicacionId: location.id, cantidad: n, precioCompraUnitario: price, proveedorNombre: "Proveedor de prueba", registrarEgresoCaja: false }, key)));
}
async function send(p, n, origin = central, destination = shopA, user = admin, key) {
  return transfers.POST(req(user, { productoId: p.id, origenId: origin.id, destinoId: destination.id, cantidad: n, observaciones: "Prueba de distribución" }, key));
}
async function resolve(transfer, action = "RECIBIR", user = managerA) {
  return transfers.PATCH(req(user, { id: transfer.id, accion: action, motivo: action === "CANCELAR" ? "Material regresó al origen" : undefined }, undefined, "PATCH"));
}
async function balance(p, location) {
  return Number((await prisma.existenciaInventario.findUnique({ where: { productoId_ubicacionId: { productoId: p.id, ubicacionId: location.id } } }))?.stockActual || 0);
}
async function invariant(p) {
  const stock = await prisma.existenciaInventario.aggregate({ where: { productoId: p.id }, _sum: { stockActual: true } });
  const transit = await prisma.traspasoInventario.aggregate({ where: { productoId: p.id, estado: "EN_TRANSITO" }, _sum: { cantidad: true } });
  const global = await prisma.productoInventario.findUniqueOrThrow({ where: { id: p.id } });
  const issued=await prisma.entregaMaterialItem.aggregate({where:{productoId:p.id},_sum:{cantidad:true,consumida:true,devuelta:true}});
  const held=Number(issued._sum.cantidad||0)-Number(issued._sum.consumida||0)-Number(issued._sum.devuelta||0);
  assert.equal(Number(global.stockActual), Number(stock._sum.stockActual || 0) + Number(transit._sum.cantidad || 0)+held);
}

before(async () => {
  await root.$executeRawUnsafe('CREATE SCHEMA "' + schema + '"');
  const baseline = fs.readFileSync(path.join(__dirname, "fixtures/inventory-baseline.sql"), "utf8");
  await prisma.$transaction(async tx => {
    for (const statement of baseline.split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
  }, { timeout: 60000 });
  await require("../scripts/migrate-store-role.cjs").migrateStoreRole(prisma);
  const opening = await product();
  await prisma.productoInventario.update({ where: { id: opening.id }, data: { stockActual: 17.5, costoPromedio: 8 } });
  openingId = opening.id;
  assert.equal(await migrateInventory(prisma), true);
  await require("../scripts/migrate-proformas.cjs").migrateProformas(prisma);
  branchA = await prisma.sucursal.create({ data: { nombre: "Sucursal A de prueba" } });
  branchB = await prisma.sucursal.create({ data: { nombre: "Sucursal B de prueba" } });
  async function user(role, branch, name) { return prisma.usuario.create({ data: { nombre: name, email: randomUUID() + "@example.invalid", passwordHash: "not-a-login-password", rol: role, sucursalId: branch?.id || null } }); }
  admin = await user("ADMIN", branchA, "Administrador prueba");
  managerA = await user("ENCARGADO", branchA, "Encargado A");
  managerB = await user("ENCARGADO", branchB, "Encargado B");
  central = await prisma.ubicacionInventario.create({ data: { nombre: "Almacén central de prueba", tipo: "ALMACEN" } });
  shopA = await prisma.ubicacionInventario.create({ data: { nombre: "Tienda A", tipo: "TIENDA", sucursalId: branchA.id } });
  shopB = await prisma.ubicacionInventario.create({ data: { nombre: "Tienda B", tipo: "TIENDA", sucursalId: branchB.id } });
}, { timeout: 60000 });

after(async () => {
  await prisma.$disconnect();
  if (/^inventory_test_[a-f0-9]{32}$/.test(schema)) await root.$executeRawUnsafe('DROP SCHEMA "' + schema + '" CASCADE');
  await root.$disconnect();
});

test("migration conserves the opening stock and is safe to repeat", async () => {
  const row = await prisma.existenciaInventario.findUniqueOrThrow({ where: { productoId_ubicacionId: { productoId: openingId, ubicacionId: "inventario-inicial" } } });
  assert.equal(Number(row.stockActual), 17.5);
  assert.equal(await migrateInventory(prisma), false);
  assert.equal(await prisma.existenciaInventario.count({ where: { productoId: openingId } }), 1);
});
test("stores require a branch; additional warehouses can be configured", async () => {
  await body(await locationRoutes.POST(req(admin, { nombre: "Tienda sin sucursal", tipo: "TIENDA" })), 400);
  const result = await body(await locationRoutes.POST(req(admin, { nombre: "Otro almacén central", tipo: "ALMACEN" })), 201);
  assert.equal(result.sucursalId, null);
});
test("purchases update the selected location and preserve the weighted cost", async () => {
  const p = await product(); await buy(p, 10); await buy(p, 10, central, admin, 20);
  assert.equal(await balance(p, central), 20);
  assert.equal(Number((await prisma.productoInventario.findUnique({ where: { id: p.id } })).costoPromedio), 15);
  await invariant(p);
});
test("purchase retries cannot duplicate stock or cash expenses", async () => {
  const p = await product(), key = randomUUID();
  const input = { productoId: p.id, ubicacionId: central.id, cantidad: 10, precioCompraUnitario: 10, proveedorNombre: "Proveedor", registrarEgresoCaja: true };
  const first = await body(await purchases.POST(req(admin, input, key)));
  await body(await purchases.POST(req(admin, input, key)));
  assert.equal(await prisma.egresoGeneralManual.count({ where: { id: first.egreso.id } }), 1);
  assert.equal(await prisma.auditoriaLog.count({ where: { entidadId: key } }), 1);
  await body(await purchases.POST(req(admin, { ...input, registrarEgresoCaja: false }, key)), 409);
  assert.equal(await balance(p, central), 10);
  assert.equal(await prisma.movimientoInventario.count({ where: { id: key } }), 1);
});
test("dispatch deducts the origin but not the destination until receipt", async () => {
  const p = await product(); await buy(p, 10);
  const transfer = await body(await send(p, 4));
  assert.equal(await balance(p, central), 6); assert.equal(await balance(p, shopA), 0);
  await invariant(p);
  await body(await resolve(transfer));
  assert.equal(await balance(p, shopA), 4); await invariant(p);
});
test("dispatch retries do not deduct the origin twice", async () => {
  const p = await product(); await buy(p, 10); const key = randomUUID();
  await body(await send(p, 4, central, shopA, admin, key));
  await body(await send(p, 4, central, shopA, admin, key));
  assert.equal(await balance(p, central), 6); await invariant(p);
});
test("only the destination manager or admin can receive", async () => {
  const p = await product(); await buy(p, 10); const transfer = await body(await send(p, 4));
  await body(await resolve(transfer, "RECIBIR", managerB), 403);
  assert.equal(await balance(p, shopA), 0);
});
test("simultaneous receipts credit the destination exactly once", async () => {
  const p = await product(); await buy(p, 10); const transfer = await body(await send(p, 4));
  const result = await Promise.all([resolve(transfer), resolve(transfer)]);
  for (const response of result) await body(response);
  assert.equal(await balance(p, shopA), 4);
  assert.equal(await prisma.movimientoInventario.count({ where: { traspasoId: transfer.id, evento: "RECEPCION" } }), 1);
  await invariant(p);
});
test("competing dispatches cannot oversell the origin", async () => {
  const p = await product(); await buy(p, 10);
  const responses = await Promise.all([send(p, 7), send(p, 7, central, shopB)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  assert.equal(await balance(p, central), 3); await invariant(p);
});
test("cancellation restores origin once and cannot reverse a received shipment", async () => {
  const p = await product(); await buy(p, 10); const t = await body(await send(p, 4));
  await body(await resolve(t, "CANCELAR", admin)); await body(await resolve(t, "CANCELAR", admin));
  assert.equal(await balance(p, central), 10); assert.equal(await balance(p, shopA), 0); await invariant(p);
  await body(await resolve(t), 409);
});
test("competing receive and cancellation resolve only one way", async () => {
  const p = await product(); await buy(p, 10); const t = await body(await send(p, 4));
  const results = await Promise.all([resolve(t), resolve(t, "CANCELAR", admin)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]); await invariant(p);
});
test("managers cannot buy into or dispatch from a different branch", async () => {
  const p = await product(); await buy(p, 10, shopB, admin);
  const purchase = await purchases.POST(req(managerA, { productoId: p.id, ubicacionId: shopB.id, cantidad: 2, precioCompraUnitario: 10, proveedorNombre: "Prueba" }));
  assert.equal(purchase.status, 403);
  await body(await send(p, 1, shopB, shopA, managerA), 403);
});
test("branch inventory does not expose quantities at other locations", async () => {
  const p = await product(); await buy(p, 10); await buy(p, 3, shopA);
  const results = await body(await inventories.GET(req(managerA, null, undefined, "GET")));
  const found = results.find(item => item.id === p.id);
  assert.equal(found.stockActual, 3); assert.equal(found.stockGlobal, undefined);
  assert.equal(found.existencias.length, 1); assert.equal(found.existencias[0].ubicacion.id, shopA.id);
});
test("an active location holding stock cannot be deactivated", async () => {
  const p = await product(); await buy(p, 1, shopA);
  await body(await locationEdit.PATCH(req(admin, { activo: false }, undefined, "PATCH"), { params: Promise.resolve({ id: shopA.id }) }), 409);
});
test("concurrent purchases and dispatch conserve all units", async () => {
  const p = await product(); await buy(p, 10);
  await Promise.all([buy(p, 5), body(await send(p, 6))]);
  assert.equal(await balance(p, central), 9); await invariant(p);
});
test("database failure rolls back stock, movement, transfer and audit together", async () => {
  const p = await product(); await buy(p, 10);
  await assert.rejects(prisma.$transaction(async tx => {
    const { lockLocations, lockProduct, takeStock } = require("../src/lib/inventory.ts");
    await lockLocations(tx, [central.id]); await lockProduct(tx, p.id); await takeStock(tx, p.id, central.id, new Prisma.Decimal(3));
    await tx.movimientoInventario.create({ data: { productoId: p.id, tipoMovimiento: "TRASPASO", cantidad: 3, stockAnterior: 10, stockNuevo: 7, usuarioId: "nonexistent-user" } });
  }));
  assert.equal(await balance(p, central), 10); await invariant(p);
});
test("work consumption uses only its selected location and updates the company total", async () => {
  const p = await product(); await buy(p, 10, shopA);
  const client = await prisma.cliente.create({ data: { nombreCompleto: "Cliente prueba", telefonos: [], direccion: "Prueba", sucursalId: branchA.id } });
  const work = await prisma.trabajo.create({ data: { codigoCorrelativo: randomUUID(), clienteId: client.id, encargadoId: admin.id, sucursalId: branchA.id,
    estado: "EN_PROCESO", tipoFlujo: "COMPLETO", subtipoCodigo: "3.3", subtipoNombre: "Prueba" } });
  const response = await execution.POST(req(admin, { accion: "REGISTRAR_MATERIAL", data: { productoId: p.id, ubicacionId: shopA.id, esDeInventario: true, cantidad: 3, descripcion: p.nombre, costoUnitario: 0.01 } }), { params: Promise.resolve({ id: work.id }) });
  const result = await body(response);
  assert.equal(Number(result.material.costoUnitario), 10);
  assert.equal(await balance(p, shopA), 7); await invariant(p);
});


test("branch receivers cannot see balances from a central warehouse", async () => {
  const movements = require("../src/app/api/inventario/movimientos/route.ts");
  const p = await product(); await buy(p, 10);
  const transfer = await body(await send(p, 2));
  await body(await resolve(transfer));
  const response = await body(await movements.GET(req(managerA, undefined, undefined, "GET")));
  const rows = response.movimientos.filter(m => m.traspasoId === transfer.id);
  assert.equal(rows.find(m => m.evento === "ENVIO").stockAnterior, null);
  assert.equal(Number(rows.find(m => m.evento === "RECEPCION").stockNuevo), 2);
  const history = await body(await purchases.GET(req(managerA, undefined, undefined, "GET")));
  assert.ok(history.compras.every(m => m.producto.stockActual === undefined));
});

test("a new branch is also a store and can receive warehouse shipments", async () => {
  const branch = await body(await branchRoutes.POST(req(admin, { nombre: "Sucursal tienda nueva", direccion: "Dirección de prueba", telefono: "12345678" })), 201);
  assert.equal(branch.ubicaciones.length, 1);
  const store = branch.ubicaciones[0];
  assert.equal(store.tipo, "TIENDA"); assert.equal(store.sucursalId, branch.id);
  assert.equal(store.nombre, branch.nombre); assert.equal(store.direccion, branch.direccion);
  const p = await product(); await buy(p, 10);
  const transfer = await body(await send(p, 4, central, store));
  await body(await resolve(transfer, "RECIBIR", admin));
  assert.equal(await balance(p, store), 4); await invariant(p);
  await body(await branchRoutes.POST(req(managerA, { nombre: "No autorizada" })), 403);
});

test('store operator works across shops but cannot operate warehouses or access other CRM modules',async()=>{
 const store=await prisma.usuario.create({data:{nombre:'Encargada de tiendas',email:randomUUID()+'@example.invalid',passwordHash:'test-only',rol:'ENCARGADO_TIENDA'}});
 function storeReq(route,data,method='POST',key=randomUUID()){return new NextRequest('http://localhost/api/'+route,{method,headers:{'Content-Type':'application/json',Cookie:'servigaz_token='+jwt.sign({id:store.id},process.env.JWT_SECRET),'Idempotency-Key':key},...(method==='GET'?{}:{body:JSON.stringify(data)})});}
 const locations=await body(await locationRoutes.GET(storeReq('ubicaciones',null,'GET')));assert.ok(locations.ubicaciones.some(item=>item.id===shopA.id));assert.ok(locations.ubicaciones.some(item=>item.id===shopB.id));assert.ok(locations.ubicaciones.every(item=>item.tipo==='TIENDA'&&!item.esInicial));
 await body(await inventories.GET(storeReq('inventario',null,'GET')));await body(await require('../src/app/api/inventario/movimientos/route.ts').GET(storeReq('inventario/movimientos',null,'GET')));
 const p=await product();await buy(p,10,central,admin);const transfer=await body(await send(p,3,central,shopA,admin));
 await body(await transfers.PATCH(storeReq('inventario/traspasos',{id:transfer.id,accion:'RECIBIR'},'PATCH')));assert.equal(await balance(p,shopA),3);
 await body(await transfers.POST(storeReq('inventario/traspasos',{productoId:p.id,origenId:central.id,destinoId:shopB.id,cantidad:1})),403);
 const move=await body(await transfers.POST(storeReq('inventario/traspasos',{productoId:p.id,origenId:shopA.id,destinoId:shopB.id,cantidad:1})));await body(await transfers.PATCH(storeReq('inventario/traspasos',{id:move.id,accion:'RECIBIR'},'PATCH')));assert.equal(await balance(p,shopB),1);
 await body(await purchases.POST(storeReq('inventario/compras',{productoId:p.id,ubicacionId:shopB.id,cantidad:1,precioCompraUnitario:10,proveedorNombre:'Proveedor de prueba',registrarEgresoCaja:true})),403);
 await body(await purchases.POST(storeReq('inventario/compras',{productoId:p.id,ubicacionId:shopB.id,cantidad:1,precioCompraUnitario:10,proveedorNombre:'Proveedor de prueba',registrarEgresoCaja:false})));assert.equal(await balance(p,shopB),2);
 for(const name of ['trabajos','clientes','proyectos','finanzas','usuarios','gestion-tienda','configuracion/precios','cotizaciones/pendientes']){const handler=require('../src/app/api/'+name+'/route.ts');await body(await handler.GET(storeReq(name,null,'GET')),403);}
 await invariant(p);
});

const documents=require('../src/app/api/proformas/route.ts');
const deliveries=require('../src/app/api/entregas/route.ts');
const documentOptions=require('../src/app/api/proformas/opciones/route.ts');
function docReq(user,route,data,method='POST',key=randomUUID()){
 return new NextRequest('http://localhost/api/'+route,{method,headers:{'Content-Type':'application/json',Cookie:'servigaz_token='+jwt.sign({id:user.id},process.env.JWT_SECRET),'Idempotency-Key':key},...(method==='GET'?{}:{body:JSON.stringify(data)})});
}
async function documentFixture(){
 const tech=await prisma.usuario.create({data:{nombre:'Técnico de materiales',email:randomUUID()+'@example.invalid',passwordHash:'test-only',rol:'TECNICO_FIJO',sucursalId:branchA.id}});
 const store=await prisma.usuario.create({data:{nombre:'Encargada de materiales',email:randomUUID()+'@example.invalid',passwordHash:'test-only',rol:'ENCARGADO_TIENDA'}});
 const client=await prisma.cliente.create({data:{nombreCompleto:'Cliente de proforma',telefonos:['76543210'],direccion:'Prueba',sucursalId:branchA.id}});
 const work=await prisma.trabajo.create({data:{codigoCorrelativo:randomUUID(),clienteId:client.id,encargadoId:managerA.id,tecnicoId:tech.id,sucursalId:branchA.id,estado:'EN_PROCESO',tipoFlujo:'COMPLETO',subtipoCodigo:'3.3',subtipoNombre:'Mantenimiento'}});
 const p=await product();await buy(p,10,shopA,admin);
 const request={id:randomUUID(),tipo:'MATERIALES',ubicacionId:shopA.id,trabajoId:work.id,tecnicoId:tech.id,validoHasta:new Date(Date.now()+15*86400000).toISOString(),items:[{productoId:p.id,cantidad:6}]};
 return {tech,store,client,work,p,request};
}
async function approvedRequest(f){const doc=await body(await documents.POST(docReq(f.tech,'proformas',f.request)));await body(await documents.PATCH(docReq(f.store,'proformas',{id:doc.id,estado:'APROBADA',motivo:'Material aprobado para el trabajo'},'PATCH')));return doc;}
async function issue(f,doc,n=4,id=randomUUID()) {return deliveries.POST(docReq(f.store,'entregas',{id,proformaId:doc.id,items:[{productoId:f.p.id,cantidad:n}]}));}
async function deliveryAction(f,d,accion,amount,user=f.tech,key=randomUUID(),item=d.items[0]){return deliveries.PATCH(docReq(user,'entregas',{id:d.id,accion,...(amount?{itemId:item.id,cantidad:amount,motivo:'Operación física comprobada'}:{})},'PATCH',key));}

test('customer proformas require a registered scoped customer and preserve prices and issuer without moving inventory',async()=>{
 const f=await documentFixture();
 const input={id:randomUUID(),tipo:'CLIENTE',ubicacionId:shopA.id,clienteId:f.client.id,validoHasta:new Date(Date.now()+86400000).toISOString(),items:[{productoId:f.p.id,cantidad:2.5,precio:20.25}]};
 await body(await documents.POST(docReq(f.store,'proformas',{...input,clienteId:undefined})),400);
 await body(await documents.POST(docReq(f.tech,'proformas',input)),403);
 await body(await documents.POST(docReq(managerB,'proformas',input)),403);
 const doc=await body(await documents.POST(docReq(f.store,'proformas',input)));assert.equal(doc.datos.total,'50.63');assert.equal(doc.datos.autor,f.store.nombre);assert.equal(doc.clienteId,f.client.id);assert.ok(doc.datos.formato.empresa);
 const historyRoute=require('../src/app/api/clientes/[id]/historial/route.ts');const history=await body(await historyRoute.GET(docReq(managerA,'clientes/'+f.client.id+'/historial',null,'GET'),{params:Promise.resolve({id:f.client.id})}));assert.ok(history.proformas.some(p=>p.id===doc.id));
 const again=await body(await documents.POST(docReq(f.store,'proformas',input)));assert.equal(again.id,doc.id);
 await body(await documents.POST(docReq(f.store,'proformas',{...input,items:[{productoId:f.p.id,cantidad:3,precio:20.25}]})),409);
 assert.equal(await balance(f.p,shopA),10);assert.equal(await prisma.entregaMaterial.count({where:{proformaId:doc.id}}),0);
 await body(await documents.PATCH(docReq(f.store,'proformas',{id:doc.id,estado:'APROBADA',motivo:'Cliente confirmó su aceptación'},'PATCH')));
 await body(await issue(f,doc),400);
 const techList=await body(await documents.GET(docReq(f.tech,'proformas',null,'GET')));assert.ok(!techList.documentos.some(d=>d.id===doc.id));
 const registered=await body(await documentOptions.POST(docReq(f.store,'proformas/opciones',{id:randomUUID(),ubicacionId:shopB.id,nombreCompleto:'Cliente nuevo de tienda',telefono:'76543210',direccion:'Calle ejemplo 123'})));assert.equal(registered.sucursalId,branchB.id);
 const techOptions=await body(await documentOptions.GET(docReq(f.tech,'proformas/opciones',null,'GET')));assert.equal(techOptions.clientes.length,0);assert.ok(techOptions.productos.every(p=>p.precioVenta===undefined&&p.costoPromedio===undefined));
 await invariant(f.p);
});

test('material requests validate assignment, branch, expiry and approval before any stock leaves',async()=>{
 const f=await documentFixture();
 await body(await documents.POST(docReq(managerB,'proformas',f.request)),403);
 await body(await documents.POST(docReq(f.tech,'proformas',{...f.request,tecnicoId:admin.id})),403);
 await body(await documents.POST(docReq(f.store,'proformas',{...f.request,ubicacionId:shopB.id})),403);
 await body(await documents.POST(docReq(f.store,'proformas',{...f.request,items:[{productoId:f.p.id,cantidad:0.001}]})),400);
 const doc=await body(await documents.POST(docReq(f.tech,'proformas',f.request)));
 assert.equal(doc.datos.total,undefined);assert.equal(doc.datos.items[0].precio,undefined);
 await body(await issue(f,doc),409);
 await body(await documents.PATCH(docReq(f.tech,'proformas',{id:doc.id,estado:'APROBADA',motivo:'Aprobar por mi cuenta'},'PATCH')),403);
 await body(await documents.PATCH(docReq(f.store,'proformas',{id:doc.id,estado:'APROBADA',motivo:'Revisado por tienda'},'PATCH')));
 await prisma.documentoProforma.update({where:{id:doc.id},data:{validoHasta:new Date(Date.now()-86400000)}});
 await body(await issue(f,doc),409);assert.equal(await balance(f.p,shopA),10);
});

test('partial delivery retries and competing deliveries cannot oversupply or duplicate store stock deductions',async()=>{
 const f=await documentFixture();const doc=await approvedRequest(f);const id=randomUUID();
 const d=await body(await issue(f,doc,4,id));const retry=await body(await issue(f,doc,4,id));assert.equal(d.id,retry.id);assert.equal(await balance(f.p,shopA),6);
 await body(await issue(f,doc,3,id),409);
 const competing=await Promise.all([issue(f,doc,2),issue(f,doc,2)]);assert.deepEqual(competing.map(r=>r.status).sort(),[200,409]);
 assert.equal(await balance(f.p,shopA),4);assert.equal(Number((await prisma.productoInventario.findUnique({where:{id:f.p.id}})).stockActual),10);
 await body(await documents.PATCH(docReq(f.store,'proformas',{id:doc.id,estado:'ANULADA',motivo:'Intento de anular con entrega'},'PATCH')),409);
 await invariant(f.p);
});

test('technician reception, consumption and physical returns preserve custody and book each cost only once',async()=>{
 const f=await documentFixture();const doc=await approvedRequest(f);const d=await body(await issue(f,doc,4));
 await body(await deliveryAction(f,d,'RECIBIR',null,f.store),403);
 await body(await deliveryAction(f,d,'CONSUMIR',1),409);
 const receiver=randomUUID();await body(await deliveryAction(f,d,'RECIBIR',null,f.tech,receiver));await body(await deliveryAction(f,d,'RECIBIR',null,f.tech,receiver));
 await body(await deliveryAction(f,d,'DEVOLVER',1,f.tech),403);
 const consumption=randomUUID();await body(await deliveryAction(f,d,'CONSUMIR',2,f.tech,consumption));await body(await deliveryAction(f,d,'CONSUMIR',2,f.tech,consumption));
 assert.equal(await prisma.materialEjecucion.count({where:{trabajoId:f.work.id}}),1);assert.equal(Number((await prisma.materialEjecucion.findFirst({where:{trabajoId:f.work.id}})).subtotalCosto),20);
 assert.equal(await balance(f.p,shopA),6);await invariant(f.p);
 const operation=randomUUID();await body(await deliveryAction(f,d,'DEVOLVER',2,f.store,operation));await body(await deliveryAction(f,d,'DEVOLVER',2,f.store,operation));assert.equal(await balance(f.p,shopA),8);await invariant(f.p);
 await body(await deliveryAction(f,d,'CONSUMIR',1),409);
 const view=await body(await deliveries.GET(docReq(f.tech,'entregas',null,'GET')));const own=view.entregas.find(e=>e.id===d.id);assert.equal(own.items[0].costoUnitario,undefined);assert.ok(own.operaciones.every(o=>o.datos.realizadoPor));assert.equal(own.proforma.datos.total,undefined);
 const foreign=await body(await deliveries.GET(docReq(managerB,'entregas',null,'GET')));assert.ok(!foreign.entregas.some(e=>e.id===d.id));
});

test('competing consume and return operations cannot settle the same issued units twice',async()=>{
 const f=await documentFixture();const doc=await approvedRequest(f);const d=await body(await issue(f,doc,4));await body(await deliveryAction(f,d,'RECIBIR'));
 const results=await Promise.all([deliveryAction(f,d,'CONSUMIR',4),deliveryAction(f,d,'DEVOLVER',4,f.store)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);await invariant(f.p);
});

test('work completion and final settlement require every delivered unit to be consumed or returned',async()=>{
 const f=await documentFixture();const doc=await approvedRequest(f);await body(await issue(f,doc,4));
 const technicalEnd=await execution.POST(docReq(f.tech,'trabajos/'+f.work.id+'/ejecucion',{accion:'FINALIZAR_TECNICO',data:{}}),{params:Promise.resolve({id:f.work.id})});await body(technicalEnd,409);
 const settlement=require('../src/app/api/trabajos/[id]/cierre-financiero/route.ts');const r=await settlement.POST(docReq(managerA,'trabajos/'+f.work.id+'/cierre-financiero',{costoManoObraReal:0,costoTransporteReal:0}),{params:Promise.resolve({id:f.work.id})});const blocked=await body(r,409);assert.match(blocked.error,/materiales entregados/);
 await prisma.trabajo.update({where:{id:f.work.id},data:{estado:'VALIDADO'}});await body(await issue(f,doc,1),409);
});

test('an out-of-stock multi-product delivery rolls back every line and its document',async()=>{
 const f=await documentFixture();const absent=await product();f.request.items.push({productoId:absent.id,cantidad:1});const doc=await approvedRequest(f);
 await body(await deliveries.POST(docReq(f.store,'entregas',{id:randomUUID(),proformaId:doc.id,items:[{productoId:f.p.id,cantidad:2},{productoId:absent.id,cantidad:1}]})),409);
 assert.equal(await balance(f.p,shopA),10);assert.equal(await prisma.entregaMaterial.count({where:{proformaId:doc.id}}),0);await invariant(f.p);
});

test('locations cannot be deactivated while their material is still held by a technician',async()=>{
 const f=await documentFixture();const isolated=await prisma.ubicacionInventario.create({data:{nombre:'Tienda de custodia aislada',tipo:'TIENDA',sucursalId:branchA.id}});await buy(f.p,10,isolated,admin);f.request.ubicacionId=isolated.id;f.request.items[0].cantidad=10;const doc=await approvedRequest(f);const delivery=await body(await issue(f,doc,10));assert.equal(await balance(f.p,isolated),0);
 await body(await locationEdit.PATCH(docReq(admin,'ubicaciones/'+isolated.id,{activo:false},'PATCH'),{params:Promise.resolve({id:isolated.id})}),409);
 await body(await deliveryAction(f,delivery,'DEVOLVER',10,f.store));await invariant(f.p);
});

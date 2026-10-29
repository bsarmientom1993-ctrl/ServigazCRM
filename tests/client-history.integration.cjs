const { test, before, after } = require("node:test");
const assert = require("node:assert/strict"); const { randomUUID } = require("node:crypto");
const fs = require("node:fs"); const path = require("node:path");
const { PrismaClient } = require("@prisma/client"); const { NextRequest } = require("next/server"); const jwt = require("jsonwebtoken");

const supplied = process.env.TEST_DATABASE_URL;
if (!supplied) throw new Error("Configura TEST_DATABASE_URL con PostgreSQL local terminado en _test.");
const base = new URL(supplied);
if (!["localhost", "127.0.0.1"].includes(base.hostname) || !base.pathname.endsWith("_test")) throw new Error("Solo se permiten bases de pruebas locales.");
const schema = "client_history_test_" + randomUUID().replaceAll("-", "");
const root = new PrismaClient({ datasources: { db: { url: base.toString() } } });
const scoped = new URL(base); scoped.searchParams.set("schema", schema); process.env.DATABASE_URL = scoped.toString(); process.env.JWT_SECRET = "catalog-local-integration-secret-only";
const { prisma } = require("../src/lib/prisma.ts");
const me = require("../src/app/api/auth/me/route.ts");
const directory = require("../src/app/api/usuarios/route.ts");
const profiles = require("../src/app/api/usuarios/[id]/route.ts");
const payments = require("../src/app/api/trabajos/[id]/pagos/route.ts");
const execution = require("../src/app/api/trabajos/[id]/ejecucion/route.ts");
const detail = require("../src/app/api/trabajos/[id]/route.ts");
const quotes = require("../src/app/api/trabajos/[id]/cotizacion/route.ts");
const closing = require("../src/app/api/trabajos/[id]/cierre-financiero/route.ts");
const visits = require("../src/app/api/trabajos/[id]/visita/route.ts");
const decisions = require("../src/app/api/trabajos/[id]/decision/route.ts");
const history = require("../src/app/api/clientes/[id]/historial/route.ts");
const clientDirectory=require('../src/app/api/clientes/route.ts');
const legacyCalculator = require("../src/app/api/cotizador/calcular/route.ts");
const { configureExampleCatalog } = require("../src/lib/catalog-examples.cjs");
const works = require("../src/app/api/trabajos/route.ts");
let admin, manager, branch, technician, outsider, client;
function req(user, body, method = "POST") { return new NextRequest("http://localhost/api/catalogo/servicios", { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), ...(user ? { Cookie: "servigaz_token=" + jwt.sign({ id: user.id }, process.env.JWT_SECRET) } : {}) }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) }); }
async function body(response, status = 200) { const data = await response.json(); assert.equal(response.status, status, JSON.stringify(data)); return data; }
before(async () => {
  await root.$executeRawUnsafe('CREATE SCHEMA "' + schema + '"');
  const sql = fs.readFileSync(path.join(__dirname, "fixtures/inventory-baseline.sql"), "utf8");
  await prisma.$transaction(async tx => { for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement); }, { timeout: 60000 });
  await require("../scripts/migrate-inventory.cjs").migrateInventory(prisma);
  await require("../scripts/migrate-proformas.cjs").migrateProformas(prisma);
  branch = await prisma.sucursal.create({ data: { nombre: "Sucursal catálogo de prueba" } });
  async function user(role) { return prisma.usuario.create({ data: { nombre: role, email: randomUUID() + "@example.invalid", rol: role, passwordHash: "not-a-password", sucursalId: branch.id } }); }
  admin = await user("ADMIN"); manager = await user("ENCARGADO"); technician = await user("TECNICO_FIJO");
  const other = await prisma.sucursal.create({ data: { nombre: "Otra sucursal" } });
  outsider = await prisma.usuario.create({ data: { nombre: "Externo", email: randomUUID() + "@example.invalid", rol: "ENCARGADO", passwordHash: "none", sucursalId: other.id } });
  client = await prisma.cliente.create({ data: { nombreCompleto: "Cliente gas", direccion: "Calle de prueba 123", telefonos: ["76543210"], sucursalId: branch.id } });
  await configureExampleCatalog(prisma, { once: true });
  await prisma.configuracionGarantia.create({ data: { subtipoCodigo: "3.3", mesesDefecto: 12, condiciones: "Condiciones de prueba", modificadoPor: admin.id } });
}, { timeout: 60000 });
after(async () => { await prisma.$disconnect(); if (/^client_history_test_[a-f0-9]{32}$/.test(schema)) await root.$executeRawUnsafe('DROP SCHEMA "' + schema + '" CASCADE'); await root.$disconnect(); });




const context = id => ({ params: Promise.resolve({ id }) });
function request(user, data, method = "GET", cursor = "") {
  return new NextRequest("http://localhost/api/clientes/test/historial" + (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""), { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), ...(user ? { Cookie: "servigaz_token=" + jwt.sign({ id: user.id }, process.env.JWT_SECRET) } : {}) }, ...(method === "GET" ? {} : { body: JSON.stringify(data) }) });
}
const quoteInput = { subtotalMateriales: 100, subtotalManoObra: 20, montoTransporte: 0 };
const existingInput = id => ({ clienteId: id, subtipoCodigo: "EQUIPO.PROVISION", subtipoCodigos: ["EQUIPO.PROVISION"], subtipoNombre: "Provisión", tipoFlujo: "SIMPLIFICADO" });
let work;
test("customer history requires a manager session and stays within the customer branch", async () => {
  await body(await history.GET(request(null), context(client.id)), 401);
  await body(await history.GET(request(technician), context(client.id)), 403);
  await body(await history.GET(request(outsider), context(client.id)), 403);
  await body(await history.GET(request(manager), context("nonexistent")), 404);
  const empty = await body(await history.GET(request(manager), context(client.id)));
  assert.equal(empty.cliente.id, client.id); assert.deepEqual(empty.trabajos, []); assert.equal(empty.siguiente, null);
});

test("unregistered calculations cannot produce anonymous quotations", async () => {
  await body(await legacyCalculator.POST(request(null, quoteInput, "POST")), 401);
  await body(await legacyCalculator.POST(request(technician, quoteInput, "POST")), 403);
  await body(await legacyCalculator.POST(request(manager, quoteInput, "POST")), 410);
  await body(await quotes.POST(request(manager, quoteInput, "POST"), context("nonexistent")), 404);
  assert.equal(await prisma.cotizacion.count(), 0);
});

test("existing customer is reused and every official quote version belongs to their order", async () => {
  const count = await prisma.cliente.count();
  work = await body(await works.POST(request(manager, existingInput(client.id), "POST")), 201);
  assert.equal(work.clienteId, client.id); assert.equal(await prisma.cliente.count(), count);
  const first = await body(await quotes.POST(request(manager, { ...quoteInput, clienteId: "forged-customer", datosFormulario: { clienteNombre: "Nombre falso" } }, "POST"), context(work.id)));
  const second = await body(await quotes.POST(request(manager, { ...quoteInput, subtotalMateriales: 150 }, "POST"), context(work.id)));
  assert.equal(first.cotizacion.datosFormularioJson.carta.clienteNombre, client.nombreCompleto);
  const result = await body(await history.GET(request(manager), context(client.id)));
  assert.equal(result.trabajos.length, 1); assert.equal(result.trabajos[0].id, work.id);
  assert.equal(result.trabajos[0].cotizaciones[0].numeroVersion, 2); assert.equal(Number(result.trabajos[0].cotizaciones[0].totalCotizado), 170);
  assert.equal((await prisma.cotizacion.findUnique({ where: { id: first.cotizacion.id } })).estado, "SUPERADA");
});

test("a newly registered customer and service are persisted together before quotation", async () => {
  const created = await body(await works.POST(request(manager, { ...existingInput(undefined), nuevoCliente: { nombreCompleto: "Cliente nuevo historial", telefono: "76543211", direccion: "Calle 456" } }, "POST")), 201);
  assert.ok(created.clienteId);
  const result = await body(await history.GET(request(manager), context(created.clienteId)));
  assert.equal(result.cliente.nombreCompleto, "Cliente nuevo historial"); assert.equal(result.trabajos[0].id, created.id);
  await body(await quotes.POST(request(manager, quoteInput, "POST"), context(created.id)));
  const original = await body(await history.GET(request(manager), context(client.id)));
  assert.deepEqual(original.trabajos.map(item => item.id), [work.id]);
});

test("pagination returns the whole customer history without foreign orders or duplicate records", async () => {
  const target = await prisma.cliente.create({ data: { nombreCompleto: "Cliente paginado", direccion: "Calle de pruebas", telefonos: ["76543212"], sucursalId: branch.id } });
  await prisma.trabajo.createMany({ data: Array.from({ length: 23 }, () => ({ id: randomUUID(), codigoCorrelativo: "HISTORY-" + randomUUID(), clienteId: target.id, encargadoId: manager.id, sucursalId: branch.id, tipoFlujo: "SIMPLIFICADO", subtipoCodigo: "EQUIPO.PROVISION", subtipoNombre: "Provisión de equipos", estado: "EVALUADO" })) });
  const first = await body(await history.GET(request(manager), context(target.id))); assert.equal(first.trabajos.length, 20); assert.ok(first.siguiente);
  const second = await body(await history.GET(request(manager, undefined, "GET", first.siguiente), context(target.id))); assert.equal(second.trabajos.length, 3); assert.equal(second.siguiente, null);
  assert.equal(new Set([...first.trabajos, ...second.trabajos].map(item => item.id)).size, 23);
  await body(await history.GET(request(manager, undefined, "GET", work.id), context(target.id)), 400);
  const foreign = await body(await works.POST(request(outsider, { ...existingInput(undefined), nuevoCliente: { nombreCompleto: "Cliente externo", telefono: "76543213", direccion: "Calle externa" } }, "POST")), 201);
  await body(await history.GET(request(manager), context(foreign.clienteId)), 403);
  const adminView = await body(await history.GET(request(admin), context(foreign.clienteId)));
  assert.deepEqual(adminView.trabajos.map(item => item.id), [foreign.id]);
});
test('client directory groups duplicate records, returns pending work only and opens full history separately',async()=>{
 const first=await prisma.cliente.create({data:{nombreCompleto:'José Cliente agrupado',direccion:'Dirección ficticia',telefonos:['+591 70000004'],sucursalId:branch.id}});
 const duplicate=await prisma.cliente.create({data:{nombreCompleto:'JOSE CLIENTE AGRUPADO',direccion:'Otra referencia',telefonos:['70000004'],sucursalId:branch.id}});
 const homonym=await prisma.cliente.create({data:{nombreCompleto:'José Cliente agrupado',direccion:'Dirección distinta',telefonos:['70000005'],sucursalId:branch.id}});
 const foreign=await prisma.cliente.create({data:{nombreCompleto:'José Cliente agrupado',direccion:'Otra sucursal',telefonos:['70000004'],sucursalId:outsider.sucursalId}});
 const make=(clienteId,estado)=>prisma.trabajo.create({data:{codigoCorrelativo:'DIRECTORY-'+randomUUID(),clienteId,encargadoId:manager.id,sucursalId:branch.id,tipoFlujo:'SIMPLIFICADO',subtipoCodigo:'EQUIPO.PROVISION',subtipoNombre:'Provisión de equipo',estado}});
 const a=await make(first.id,'EVALUADO'),b=await make(duplicate.id,'VALIDADO'),done=await make(duplicate.id,'FINALIZADO_FINANCIERO');
 await make(first.id,'CANCELADO');await make(first.id,'RECHAZADO');await make(first.id,'ARCHIVADO');
 function directoryReq(user,historyId){return new NextRequest('http://localhost/api/clientes?directorio=1'+(historyId?'&historial='+historyId:''),{headers:{Cookie:'servigaz_token='+jwt.sign({id:user.id},process.env.JWT_SECRET)}});}
 const result=await body(await clientDirectory.GET(directoryReq(manager)));const card=result.find(c=>c.registrosIds.includes(first.id));assert.equal(result.filter(c=>c.registrosIds.includes(first.id)||c.registrosIds.includes(duplicate.id)).length,1);
 assert.deepEqual(new Set(card.pendientes.map(w=>w.id)),new Set([a.id,b.id]));assert.ok(!JSON.stringify(result).includes(done.id));assert.ok(!card.registrosIds.includes(foreign.id));assert.ok(result.some(c=>c.id===homonym.id));
 const full=await body(await clientDirectory.GET(directoryReq(manager,duplicate.id)));assert.equal(full.trabajos.length,6);assert.ok(full.trabajos.some(w=>w.id===done.id));assert.ok(full.trabajos.every(w=>!('cotizaciones'in w)&&!('pagos'in w)));
 await body(await clientDirectory.GET(directoryReq(outsider,first.id)),404);
 const raw=await body(await clientDirectory.GET(req(manager,undefined,'GET')));assert.ok(raw.some(c=>c.id===first.id));assert.ok(raw.some(c=>c.id===duplicate.id));assert.equal(await prisma.cliente.count({where:{id:{in:[first.id,duplicate.id]}}}),2);
});

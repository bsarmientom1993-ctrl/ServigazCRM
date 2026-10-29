const { test, before, after } = require("node:test");
const assert = require("node:assert/strict"); const { randomUUID } = require("node:crypto");
const fs = require("node:fs"); const path = require("node:path");
const { PrismaClient } = require("@prisma/client"); const { NextRequest } = require("next/server"); const jwt = require("jsonwebtoken");

const supplied = process.env.TEST_DATABASE_URL;
if (!supplied) throw new Error("Configura TEST_DATABASE_URL con PostgreSQL local terminado en _test.");
const base = new URL(supplied);
if (!["localhost", "127.0.0.1"].includes(base.hostname) || !base.pathname.endsWith("_test")) throw new Error("Solo se permiten bases de pruebas locales.");
const schema = "profiles_test_" + randomUUID().replaceAll("-", "");
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
const { newGasProject } = require("../src/lib/gas-data.ts");
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
  await require("../scripts/migrate-store-role.cjs").migrateStoreRole(prisma);
  await require("../scripts/migrate-user-roles.cjs").migrateUserRoles(prisma);
  await require("../scripts/migrate-user-roles.cjs").migrateUserRoles(prisma);
  branch = await prisma.sucursal.create({ data: { nombre: "Sucursal catálogo de prueba" } });
  async function user(role) { return prisma.usuario.create({ data: { nombre: role, email: randomUUID() + "@example.invalid", rol: role, passwordHash: "not-a-password", sucursalId: branch.id } }); }
  admin = await user("ADMIN"); manager = await user("ENCARGADO"); technician = await user("TECNICO_FIJO");
  const other = await prisma.sucursal.create({ data: { nombre: "Otra sucursal" } });
  outsider = await prisma.usuario.create({ data: { nombre: "Externo", email: randomUUID() + "@example.invalid", rol: "ENCARGADO", passwordHash: "none", sucursalId: other.id } });
  client = await prisma.cliente.create({ data: { nombreCompleto: "Cliente gas", direccion: "Calle de prueba 123", telefonos: ["76543210"], sucursalId: branch.id } });
  await prisma.configuracionGarantia.create({ data: { subtipoCodigo: "3.3", mesesDefecto: 12, condiciones: "Condiciones de prueba", modificadoPor: admin.id } });
}, { timeout: 60000 });
after(async () => { await prisma.$disconnect(); if (/^profiles_test_[a-f0-9]{32}$/.test(schema)) await root.$executeRawUnsafe('DROP SCHEMA "' + schema + '" CASCADE'); await root.$disconnect(); });



const context = id => ({ params: Promise.resolve({ id }) });
test("profile updates require a session and cannot change role, branch, password or another user's identity", async () => {
  await body(await me.PATCH(req(null, { nombre: "Sin sesión" }, "PATCH")), 401);
  await body(await directory.GET(req(manager, undefined, "GET")), 403);
  await body(await profiles.PATCH(req(manager, { nombre: "Otra persona" }, "PATCH"), context(admin.id)), 403);
  for (const patch of [{ rol: "ADMIN" }, { sucursalId: "other" }, { passwordHash: "injected" }, { email: "other@example.invalid" }, { id: admin.id }]) {
    await body(await me.PATCH(req(manager, { nombre: "Nombre válido", ...patch }, "PATCH")), 400);
  }
  await body(await me.PATCH(req(manager, { nombre: "  " }, "PATCH")), 400);
  const before = await prisma.usuario.findUnique({ where: { id: manager.id } });
  const result = await body(await me.PATCH(req(manager, { nombre: "  Marta Soto  ", telefono: "+591 70000000" }, "PATCH")));
  assert.equal(result.user.nombre, "Marta Soto");
  const after = await prisma.usuario.findUnique({ where: { id: manager.id } });
  for (const field of ["rol", "sucursalId", "passwordHash", "email"]) assert.equal(after[field], before[field]);
  const session = await body(await me.GET(req(manager, undefined, "GET")));
  assert.equal(session.user.nombre, "Marta Soto"); assert.equal(session.user.telefono, "+591 70000000"); assert.equal(session.user.passwordHash, undefined);
});

test("administrator configures existing team identities and records the actual editor", async () => {
  const users = await body(await directory.GET(req(admin, undefined, "GET")));
  assert.ok(users.some(u => u.id === technician.id)); assert.ok(users.every(u => !("passwordHash" in u)));
  await body(await profiles.PATCH(req(admin, { nombre: "Pedro Muñoz", telefono: "" }, "PATCH"), context(technician.id)));
  const tech = await prisma.usuario.findUnique({ where: { id: technician.id } }); assert.equal(tech.nombre, "Pedro Muñoz"); assert.equal(tech.rol, "TECNICO_FIJO");
  const audit = await prisma.auditoriaLog.findFirst({ where: { modulo: "PERFILES", entidadId: technician.id } });
  assert.equal(audit.usuarioId, admin.id); assert.equal(audit.valoresNuevos.nombre, "Pedro Muñoz");
  await body(await profiles.PATCH(req(admin, { nombre: "No existe", telefono: "" }, "PATCH"), context("nonexistent")), 404);
});

test("quote, sale, payment, execution and closure retain their authors across later profile edits", async () => {
  const work = await prisma.trabajo.create({ data: { codigoCorrelativo: "PROFILE-" + randomUUID(), clienteId: client.id, encargadoId: manager.id, tecnicoId: technician.id, sucursalId: branch.id, tipoFlujo: "COMPLETO", subtipoCodigo: "3.3", subtipoNombre: "Diagnóstico y reparación", estado: "EVALUADO" } });
  const ctx = context(work.id);
  const { cotizacion } = await body(await quotes.POST(req(manager, { subtotalMateriales: 100, subtotalManoObra: 100, montoTransporte: 0 }), ctx));
  assert.equal(cotizacion.datosFormularioJson.carta.cotizadoPorNombre, "Marta Soto");
  await body(await me.PATCH(req(manager, { nombre: "Marta Rojas", telefono: "" }, "PATCH")));
  await body(await decisions.POST(req(manager, { decision: "APROBAR", cotizacionId: cotizacion.id }), ctx));
  await body(await payments.POST(req(manager, { monto: 200, metodoPago: "EFECTIVO", numeroReferencia: "PROFILE-" + randomUUID() }), ctx));
  await body(await execution.POST(req(technician, { accion: "INICIAR_EJECUCION" }), ctx));
  await body(await execution.POST(req(technician, { accion: "FINALIZAR_TECNICO", data: { fotosTermino: ["https://example.invalid/a", "https://example.invalid/b", "https://example.invalid/c"], observacionesTermino: "Trabajo revisado y pruebas satisfactorias." } }), ctx));
  await body(await execution.POST(req(manager, { accion: "VALIDAR_ENCARGADO" }), ctx));
  await body(await closing.POST(req(manager, { costoManoObraReal: 20, costoTransporteReal: 5 }), ctx));
  await body(await me.PATCH(req(manager, { nombre: "Marta Actual", telefono: "" }, "PATCH")));
  const final = await body(await detail.GET(req(manager, undefined, "GET"), ctx));
  assert.equal(final.cotizaciones[0].emitidoPorNombre, "Marta Soto");
  for (const label of ["Venta confirmada", "Pago registrado", "Calidad validada", "Cierre financiero realizado"]) assert.equal(final.historialActividad.find(e => e.accion === label).nombre, "Marta Rojas");
  assert.equal(final.historialActividad.find(e => e.accion === "Cotización emitida").nombre, "Marta Soto");
  assert.equal(final.historialActividad.find(e => e.accion === "Trabajo terminado por el técnico").nombre, "Pedro Muñoz");
  await body(await detail.GET(req(outsider, undefined, "GET"), ctx), 403);
});

const switchRole=require('../src/app/api/auth/rol/route.ts');
const {requireSession}=require('../src/lib/auth.ts');
function roleReq(user,path,body,method='POST',role){return new NextRequest('http://localhost/api/'+path,{method,headers:{'Content-Type':'application/json',...(user?{Cookie:'servigaz_token='+jwt.sign({id:user.id,rol:'ADMIN'},process.env.JWT_SECRET)+(role?'; servigaz_rol='+role:'')}:{})},...(method==='GET'?{}:{body:JSON.stringify(body)})});}
async function member(name='Persona con roles'){return prisma.usuario.create({data:{nombre:name,email:randomUUID()+'@example.invalid',passwordHash:'not-a-password',rol:'TECNICO_FIJO',sucursalId:branch.id}});}

test('administrator assigns multiple checkbox roles and each role keeps its own server restrictions',async()=>{
 const person=await member();const changes={roles:['TECNICO_FIJO','ENCARGADO_TIENDA']};
 await body(await profiles.PATCH(roleReq(manager,'usuarios/'+person.id,changes,'PATCH'),context(person.id)),403);
 const saved=await body(await profiles.PATCH(roleReq(admin,'usuarios/'+person.id,changes,'PATCH'),context(person.id)));assert.deepEqual(saved.user.roles,['TECNICO_FIJO','ENCARGADO_TIENDA']);
 const listed=await body(await directory.GET(roleReq(admin,'usuarios',null,'GET')));assert.equal(listed.find(u=>u.id===person.id).roles.length,2);
 const techSession=await body(await me.GET(roleReq(person,'auth/me',null,'GET','TECNICO_FIJO')));assert.equal(techSession.user.rol,'TECNICO_FIJO');assert.equal(techSession.user.roles.length,2);
 const switched=await body(await switchRole.POST(roleReq(person,'auth/rol',{rol:'ENCARGADO_TIENDA'})));assert.equal(switched.rol,'ENCARGADO_TIENDA');
 const storeSession=await body(await me.GET(roleReq(person,'auth/me',null,'GET','ENCARGADO_TIENDA')));assert.equal(storeSession.user.rol,'ENCARGADO_TIENDA');
 await body(await directory.GET(roleReq(person,'usuarios',null,'GET','ENCARGADO_TIENDA')),403);
 await body(await switchRole.POST(roleReq(person,'auth/rol',{rol:'ADMIN'},'POST','ENCARGADO_TIENDA')),403);
 await body(await directory.GET(roleReq(person,'usuarios',null,'GET','ADMIN')),403);
 const audit=await prisma.auditoriaLog.findFirst({where:{modulo:'USUARIOS',entidadId:person.id}});assert.equal(audit.usuarioId,admin.id);assert.deepEqual(audit.valoresNuevos.roles,changes.roles);
});

test('revocation applies to an existing signed session, and no roles disables login access',async()=>{
 const person=await member();await body(await profiles.PATCH(roleReq(admin,'usuarios/'+person.id,{roles:['TECNICO_FIJO','ADMIN']},'PATCH'),context(person.id)));
 await body(await directory.GET(roleReq(person,'usuarios',null,'GET','ADMIN')));
 await body(await profiles.PATCH(roleReq(admin,'usuarios/'+person.id,{roles:['TECNICO_FIJO']},'PATCH'),context(person.id)));
 await body(await directory.GET(roleReq(person,'usuarios',null,'GET','ADMIN')),403);
 const after=await body(await me.GET(roleReq(person,'auth/me',null,'GET','ADMIN')));assert.equal(after.user.rol,'TECNICO_FIJO');
 await body(await profiles.PATCH(roleReq(admin,'usuarios/'+person.id,{roles:[]},'PATCH'),context(person.id)));
 assert.equal((await prisma.usuario.findUnique({where:{id:person.id}})).estado,'INACTIVO');assert.equal((await body(await me.GET(roleReq(person,'auth/me',null,'GET')))).user,null);
 await assert.rejects(()=>requireSession(roleReq(person,'auth/rol',{},'POST')),e=>e.status===401);
 await body(await profiles.PATCH(roleReq(admin,'usuarios/'+person.id,{roles:['ENCARGADO_TIENDA']},'PATCH'),context(person.id)));
 const restored=await body(await me.GET(roleReq(person,'auth/me',null,'GET')));assert.equal(restored.user.rol,'ENCARGADO_TIENDA');assert.equal((await prisma.usuario.findUnique({where:{id:person.id}})).estado,'ACTIVO');
});

test('technical assignment recognizes a secondary technician role and stops listing it once removed',async()=>{
 const person=await member();await body(await profiles.PATCH(roleReq(admin,'usuarios/'+person.id,{roles:['ENCARGADO_TIENDA']},'PATCH'),context(person.id)));
 await body(await profiles.PATCH(roleReq(admin,'usuarios/'+person.id,{roles:['ENCARGADO_TIENDA','TECNICO_FIJO']},'PATCH'),context(person.id)));
 const techRoute=require('../src/app/api/tecnicos/route.ts');const listed=await body(await techRoute.GET(roleReq(admin,'tecnicos',null,'GET')));assert.ok(listed.some(t=>t.id===person.id));
 await body(await profiles.PATCH(roleReq(admin,'usuarios/'+person.id,{roles:['ENCARGADO_TIENDA']},'PATCH'),context(person.id)));
 const removed=await body(await techRoute.GET(roleReq(admin,'tecnicos',null,'GET')));assert.ok(!removed.some(t=>t.id===person.id));
});

test('last active administrator is protected and role inputs cannot modify other account fields',async()=>{
 for(const changes of [{roles:[]},{roles:['TECNICO_FIJO']}])await body(await profiles.PATCH(roleReq(admin,'usuarios/'+admin.id,changes,'PATCH'),context(admin.id)),409);
 const person=await member();
 for(const invalid of [{roles:['ADMIN','ADMIN']},{roles:['SUPERADMIN']},{roles:['ADMIN'],passwordHash:'forged'},{roles:['ADMIN'],email:'forged@example.invalid'}])await body(await profiles.PATCH(roleReq(admin,'usuarios/'+person.id,invalid,'PATCH'),context(person.id)),400);
 await body(await me.PATCH(roleReq(person,'auth/me',{nombre:'Cambio indebido',roles:['ADMIN']},'PATCH')),400);
});

test('concurrent administrator removals cannot leave the system without an active administrator',async()=>{
 const second=await member('Segundo administrador');await body(await profiles.PATCH(roleReq(admin,'usuarios/'+second.id,{roles:['ADMIN']},'PATCH'),context(second.id)));
 const results=await Promise.all([profiles.PATCH(roleReq(admin,'usuarios/'+second.id,{roles:['TECNICO_FIJO']},'PATCH'),context(second.id)),profiles.PATCH(roleReq(second,'usuarios/'+admin.id,{roles:['TECNICO_FIJO']},'PATCH','ADMIN'),context(admin.id))]);
 assert.equal(results.filter(r=>r.status===200).length,1);assert.ok(results.every(r=>[200,403,409].includes(r.status)));
 const {rolesOf}=require('../src/lib/user-roles.ts');const remaining=await prisma.usuario.findMany({where:{estado:'ACTIVO'}});assert.equal(remaining.filter(u=>rolesOf(u).includes('ADMIN')).length,1);
});

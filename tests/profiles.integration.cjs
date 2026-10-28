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

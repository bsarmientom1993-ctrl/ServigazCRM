const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs"); const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const { NextRequest } = require("next/server"); const jwt = require("jsonwebtoken");
const supplied = process.env.TEST_DATABASE_URL;
if (!supplied) throw new Error("Configura TEST_DATABASE_URL con una base PostgreSQL local terminada en _test.");
const base = new URL(supplied);
if (!["localhost", "127.0.0.1"].includes(base.hostname) || !base.pathname.endsWith("_test")) throw new Error("Solo se permite una base de pruebas local.");
const schema = "wizard_test_" + randomUUID().replaceAll("-", "");
const root = new PrismaClient({ datasources: { db: { url: base.toString() } } });
const scoped = new URL(base); scoped.searchParams.set("schema", schema);
process.env.DATABASE_URL = scoped.toString(); process.env.JWT_SECRET = "wizard-local-integration-tests-secret-only";
const { prisma } = require("../src/lib/prisma.ts");
const works = require("../src/app/api/trabajos/route.ts");
const availability = require("../src/app/api/tecnicos/disponibilidad/route.ts");
const visits = require("../src/app/api/trabajos/[id]/visita/route.ts");
let manager, otherManager, techA, techB, outsider, branch, otherBranch, client;
const config = { duracionMinutos: 60, margenMinutos: 30, zonaHoraria: "America/La_Paz" };
function request(user, data, key = randomUUID(), method = "POST", query = "") {
  return new NextRequest("http://localhost/api/test" + query, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": key, Cookie: "servigaz_token=" + jwt.sign({ id: user.id }, process.env.JWT_SECRET) }, ...(method === "GET" ? {} : { body: JSON.stringify(data) }) });
}
async function result(response, expected = 201) { const value = await response.json(); assert.equal(response.status, expected, JSON.stringify(value)); return value; }
function input(patch = {}) { return { nuevoCliente: { nombreCompleto: "Cliente prueba", telefono: "76543210", direccion: "Calle 123", email: null }, subtipoCodigo: "GAS_NUEVO", subtipoCodigos: ["GAS_NUEVO"], subtipoNombre: "Gas", tipoFlujo: "COMPLETO", ...patch }; }
function at(day, hour = 13) { return "2030-06-" + String(day).padStart(2, "0") + "T" + String(hour).padStart(2, "0") + ":00:00.000Z"; }
async function agenda(user, day, overrides = {}) {
  const params = new URLSearchParams({ desde: at(day, 13), hasta: at(day, 21), duracionMinutos: "60", margenMinutos: "30", zonaHoraria: config.zonaHoraria, ...overrides });
  return availability.GET(request(user, undefined, undefined, "GET", "?" + params));
}
before(async () => {
  await root.$executeRawUnsafe('CREATE SCHEMA "' + schema + '"');
  const sql = fs.readFileSync(path.join(__dirname, "fixtures/inventory-baseline.sql"), "utf8");
  await prisma.$transaction(async tx => { for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement); }, { timeout: 60000 });
  branch = await prisma.sucursal.create({ data: { nombre: "Sucursal pruebas" } }); otherBranch = await prisma.sucursal.create({ data: { nombre: "Otra sucursal" } });
  async function user(name, role, branchId) { return prisma.usuario.create({ data: { nombre: name, email: randomUUID() + "@example.invalid", passwordHash: "not-a-password", rol: role, sucursalId: branchId } }); }
  manager = await user("Encargado", "ENCARGADO", branch.id); otherManager = await user("Otro encargado", "ENCARGADO", otherBranch.id);
  techA = await user("Técnico A", "TECNICO_FIJO", branch.id); techB = await user("Técnico B", "TECNICO_FIJO", branch.id); outsider = await user("Técnico externo", "TECNICO_FIJO", otherBranch.id);
  client = await prisma.cliente.create({ data: { nombreCompleto: "Cliente existente", telefonos: ["12345678"], direccion: "Calle 42", sucursalId: branch.id } });
  const gas = await prisma.catalogoCategoria.create({ data: { codigo: "GAS", nombre: "Gas", requiereVisita: true } });
  const other = await prisma.catalogoCategoria.create({ data: { codigo: "OTROS", nombre: "Otro", requiereVisita: false } });
  await prisma.catalogoSubtipo.createMany({ data: [{ codigo: "GAS_NUEVO", nombre: "Instalación de gas", categoriaId: gas.id }, { codigo: "OTR.1", nombre: "Revisión", categoriaId: other.id }] });
  await prisma.configuracionPersonal.create({ data: { horaEntrada: "08:30", horaSalida: "18:00", modificadoPor: manager.id } });
}, { timeout: 60000 });
after(async () => { await prisma.$disconnect(); if (/^wizard_test_[a-f0-9]{32}$/.test(schema)) await root.$executeRawUnsafe('DROP SCHEMA "' + schema + '" CASCADE'); await root.$disconnect(); });

test("client and service create a pending job without a hidden technician or time", async () => {
  const work = await result(await works.POST(request(manager, input({ detallesCliente: "Llegar por la puerta lateral", preferenciaCliente: { fecha: "2030-06-03", desde: "10:00", hasta: "14:00" } }))));
  assert.equal(work.estado, "BORRADOR"); assert.equal(work.tecnicoId, null); assert.equal(work.subtipoCodigo, "GAS_NUEVO");
  assert.match(work.observaciones, /puerta lateral/); assert.equal(work.fechasSla.preferenciaCliente.desde, "10:00");
  assert.equal(await prisma.visitaTecnica.count({ where: { trabajoId: work.id } }), 0);
});
test("direct work is created without pretending a quotation was already issued", async () => {
  const work = await result(await works.POST(request(manager, input({ subtipoCodigo: "OTR.1", subtipoCodigos: ["OTR.1"], tipoFlujo: "SIMPLIFICADO" }))));
  assert.equal(work.estado, "EVALUADO"); assert.equal(await prisma.cotizacion.count({ where: { trabajoId: work.id } }), 0);
});
test("an existing client is reused and mixed categories keep server service names", async () => {
  const count = await prisma.cliente.count();
  const work = await result(await works.POST(request(manager, input({ clienteId: client.id, nuevoCliente: null, subtipoCodigos: ["GAS_NUEVO", "OTR.1"], subtipoNombre: "Forged" }))));
  assert.equal(await prisma.cliente.count(), count); assert.equal(work.clienteId, client.id); assert.equal(work.tipoFlujo, "COMPLETO"); assert.match(work.subtipoNombre, /Instalación de gas/);
});
test("availability compares all branch technicians and protects other branches", async () => {
  const work = await result(await works.POST(request(manager, input({ tecnicoId: techA.id, fechaProgramada: at(4), agenda: config }))));
  const response = await result(await agenda(manager, 4), 200);
  assert.deepEqual(response.tecnicos.map(t => t.id).sort(), [techA.id, techB.id].sort());
  const first = response.tecnicos.find(t => t.id === techA.id), second = response.tecnicos.find(t => t.id === techB.id);
  assert.equal(first.ocupaciones.length, 1); assert.ok(!first.horarios.some(s => s.inicio === at(4))); assert.ok(second.horarios.some(s => s.inicio === at(4)));
  assert.equal(first.ocupaciones[0].inicio, at(4)); assert.equal(await prisma.visitaTecnica.count({ where: { trabajoId: work.id } }), 1);
  await result(await availability.GET(new NextRequest("http://localhost/api/tecnicos/disponibilidad")), 401);
  await result(await agenda(techA, 4), 403);
});
test("approved leave removes all slots and cannot be bypassed during save", async () => {
  await prisma.permisoPersonal.create({ data: { usuarioId: techA.id, fechaPermiso: new Date("2030-06-05T00:00:00Z"), motivo: "Prueba", descripcion: "Ausencia aprobada", comprobanteUrl: "https://example.invalid/test", estado: "APROBADO" } });
  const response = await result(await agenda(manager, 5), 200);
  assert.equal(response.tecnicos.find(t => t.id === techA.id).horarios.length, 0);
  await result(await works.POST(request(manager, input({ tecnicoId: techA.id, fechaProgramada: at(5), agenda: config }))), 409);
});
test("simultaneous reservations for one technician cannot overlap", async () => {
  const responses = await Promise.all([works.POST(request(manager, input({ tecnicoId: techA.id, fechaProgramada: at(6), agenda: config }))), works.POST(request(manager, input({ tecnicoId: techA.id, fechaProgramada: at(6), agenda: config })))]);
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
  assert.equal(await prisma.visitaTecnica.count({ where: { tecnicoId: techA.id, fechaProgramada: new Date(at(6)) } }), 1);
});
test("creation retry cannot duplicate the client, job or reservation", async () => {
  const key = randomUUID(), payload = input({ tecnicoId: techB.id, fechaProgramada: at(7), agenda: config });
  const before = await prisma.cliente.count();
  const first = await result(await works.POST(request(manager, payload, key))); const retry = await result(await works.POST(request(manager, payload, key)));
  assert.equal(first.id, retry.id); assert.equal(await prisma.cliente.count(), before + 1);
  assert.equal(await prisma.visitaTecnica.count({ where: { trabajoId: first.id } }), 1);
  await result(await works.POST(request(manager, { ...payload, observaciones: "changed" }, key)), 409);
});
test("existing-job scheduling shares conflict protection and permits an adjacent slot", async () => {
  await result(await works.POST(request(manager, input({ tecnicoId: techB.id, fechaProgramada: at(8), agenda: config }))));
  const other = await result(await works.POST(request(manager, input())));
  const context = { params: Promise.resolve({ id: other.id }) };
  await result(await visits.POST(request(manager, { accion: "AGENDAR_VISITA", tecnicoId: techB.id, fechaProgramada: at(8, 14), agenda: config }), context), 409);
  await result(await visits.POST(request(manager, { accion: "AGENDAR_VISITA", tecnicoId: techB.id, fechaProgramada: "2030-06-08T14:30:00.000Z", agenda: config }), context), 200);
});
test("invalid client, past date, out-of-hours and out-of-branch assignments cannot save", async () => {
  await result(await works.POST(request(manager, input({ nuevoCliente: { nombreCompleto: "A", telefono: "abc", direccion: "" } }))), 400);
  await result(await works.POST(request(manager, input({ tecnicoId: techA.id, fechaProgramada: "2020-01-01T13:00:00Z", agenda: config }))), 400);
  await result(await works.POST(request(manager, input({ tecnicoId: techA.id, fechaProgramada: at(9, 23), agenda: config }))), 409);
  await result(await works.POST(request(manager, input({ tecnicoId: outsider.id, fechaProgramada: at(9), agenda: config }))), 400);
  await result(await works.POST(request(otherManager, input({ clienteId: client.id, nuevoCliente: null }))), 403);
});

test("wizard and existing-job scheduling cannot concurrently reserve the same technician", async () => {
  const pending = await result(await works.POST(request(manager, input())));
  const responses = await Promise.all([
    works.POST(request(manager, input({ tecnicoId: techA.id, fechaProgramada: at(10), agenda: config }))),
    visits.POST(request(manager, { accion: "AGENDAR_VISITA", tecnicoId: techA.id, fechaProgramada: at(10), agenda: config }), { params: Promise.resolve({ id: pending.id }) }),
  ]);
  assert.equal(responses.filter(r => r.status === 200 || r.status === 201).length, 1);
  assert.equal(responses.filter(r => r.status === 409).length, 1);
  assert.equal(await prisma.visitaTecnica.count({ where: { tecnicoId: techA.id, fechaProgramada: new Date(at(10)) } }), 1);
});
test("suggestions stay inside the client preference and allow only visits that fit", async () => {
  const response = await result(await agenda(manager, 11, { desde: at(11, 14), hasta: at(11, 15), duracionMinutos: "30" }), 200);
  assert.ok(response.tecnicos.every(t => t.horarios.every(s => s.inicio >= at(11, 14) && s.fin <= at(11, 15))));
  const noFit = await result(await agenda(manager, 11, { desde: at(11, 14), hasta: at(11, 15), duracionMinutos: "120" }), 200);
  assert.ok(noFit.tecnicos.every(t => t.horarios.length === 0));
});

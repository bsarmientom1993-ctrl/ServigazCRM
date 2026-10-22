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
const schema = "agenda_test_" + randomUUID().replaceAll("-", "");
const root = new PrismaClient({ datasources: { db: { url: base.toString() } } });
const scoped = new URL(base); scoped.searchParams.set("schema", schema);
process.env.DATABASE_URL = scoped.toString(); process.env.JWT_SECRET = "wizard-local-integration-tests-secret-only";
const { prisma } = require("../src/lib/prisma.ts");
const personalAgenda = require("../src/app/api/tecnicos/mi-agenda/route.ts");
const works = require("../src/app/api/trabajos/route.ts");
const availability = require("../src/app/api/tecnicos/disponibilidad/route.ts");
const visits = require("../src/app/api/trabajos/[id]/visita/route.ts");
const detail = require("../src/app/api/trabajos/[id]/route.ts");
const execution = require("../src/app/api/trabajos/[id]/ejecucion/route.ts");
const inventory = require("../src/app/api/inventario/route.ts");
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
  await require("../scripts/migrate-inventory.cjs").migrateInventory(prisma);
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
after(async () => { await prisma.$disconnect(); if (/^agenda_test_[a-f0-9]{32}$/.test(schema)) await root.$executeRawUnsafe('DROP SCHEMA "' + schema + '" CASCADE'); await root.$disconnect(); });


async function fixture(technician = techA, date = "2030-06-03T13:00:00Z", overrides = {}) {
  const work = await prisma.trabajo.create({ data: { codigoCorrelativo: "AGENDA-" + randomUUID(), clienteId: client.id, encargadoId: manager.id, tecnicoId: technician.id, sucursalId: branch.id, tipoFlujo: "COMPLETO", subtipoCodigo: "GAS_NUEVO", subtipoNombre: "Instalación de gas", estado: "EVALUACION_PENDIENTE", observaciones: "Ingresar por la puerta lateral", fechasSla: { preferenciaCliente: { fecha: "2030-06-03", desde: "09:00", hasta: "12:00" } }, ...(overrides.work || {}) } });
  const visit = await prisma.visitaTecnica.create({ data: { trabajoId: work.id, tecnicoId: technician.id, fechaProgramada: new Date(date), condicionesJson: { agenda: { duracionMinutos: 60, margenMinutos: 15 } }, ...(overrides.visit || {}) } });
  return { work, visit };
}
function query(actor, date = "2030-06-03", days = 1, extra = "") { return personalAgenda.GET(request(actor, undefined, undefined, "GET", "?fecha=" + date + "&dias=" + days + extra)); }
test("personal agenda requires a technician session and ignores requested identity changes", async () => {
  await result(await personalAgenda.GET(new NextRequest("http://localhost/api/tecnicos/mi-agenda")), 401);
  await result(await query(manager), 403);
  const mine = await fixture(); await fixture(techB);
  await fixture(techA, "2030-06-03T14:00:00Z", { work: { tecnicoId: techB.id } });
  await fixture(techA, "2030-06-03T15:00:00Z", { visit: { tecnicoId: techB.id } });
  const data = await result(await query(techA, undefined, 1, "&tecnicoId=" + techB.id), 200);
  assert.deepEqual(data.visitas.map(v => v.id), [mine.visit.id]);
  assert.equal(data.visitas[0].trabajo.cliente.nombreCompleto, client.nombreCompleto);
  assert.equal(data.visitas[0].trabajo.indicaciones, "Ingresar por la puerta lateral");
  assert.equal(data.visitas[0].preferenciaCliente.desde, "09:00");
  assert.equal(data.visitas[0].fin, "2030-06-03T14:00:00.000Z");
  assert.equal(data.visitas[0].libreDesde, "2030-06-03T14:15:00.000Z");
  assert.equal(data.zonaHoraria, "America/La_Paz");
  assert.ok(!JSON.stringify(data).includes("totalCotizado")); assert.ok(!JSON.stringify(data).includes("passwordHash"));
});
test("day and seven-day boundaries include overlaps and exclude the exact next period", async () => {
  const overlap = await fixture(techA, "2030-06-06T03:30:00Z", { visit: { condicionesJson: { agenda: { duracionMinutos: 60, margenMinutos: 0 } } } });
  const before = await fixture(techA, "2030-06-06T03:00:00Z", { visit: { condicionesJson: { agenda: { duracionMinutos: 60, margenMinutos: 0 } } } });
  const last = await fixture(techA, "2030-06-07T03:59:00Z");
  const next = await fixture(techA, "2030-06-07T04:00:00Z");
  const day = await result(await query(techA, "2030-06-06"), 200);
  assert.ok(day.visitas.some(v => v.id === overlap.visit.id)); assert.ok(day.visitas.some(v => v.id === last.visit.id));
  assert.ok(!day.visitas.some(v => [before.visit.id, next.visit.id].includes(v.id)));
  const end = await fixture(techA, "2030-06-13T04:00:00Z");
  const week = await result(await query(techA, "2030-06-06", 7), 200);
  assert.ok(week.visitas.some(v => v.id === next.visit.id)); assert.ok(!week.visitas.some(v => v.id === end.visit.id));
  await result(await query(techA, "2030-02-31"), 400); await result(await query(techA, "2030-06-03", 365), 400);
});
test("cancelled and completed work are distinguished without automatically completing overdue visits", async () => {
  const cancelled = await fixture(techA, "2030-06-15T13:00:00Z", { work: { estado: "CANCELADO" } });
  const completed = await fixture(techA, "2030-06-15T14:00:00Z", { visit: { completada: true } });
  const finished = await fixture(techA, "2030-06-15T15:00:00Z", { work: { estado: "TERMINADO_TECNICO" } });
  const old = await fixture(techA, "2020-06-15T13:00:00Z");
  const data = await result(await query(techA, "2030-06-15"), 200);
  assert.equal(data.visitas.find(v => v.id === cancelled.visit.id).estado, "CANCELADA");
  assert.equal(data.visitas.find(v => v.id === completed.visit.id).estado, "COMPLETADA");
  assert.equal(data.visitas.find(v => v.id === finished.visit.id).estado, "COMPLETADA");
  const overdue = await result(await query(techA, "2020-06-15"), 200); assert.equal(overdue.visitas.find(v => v.id === old.visit.id).estado, "VENCIDA");
  assert.equal((await prisma.visitaTecnica.findUnique({ where: { id: old.visit.id } })).completada, false);
});
test("orders without a next visit stay assigned to their technician and disappear when a visit is scheduled", async () => {
  const mine = await fixture(techA, "2030-06-20T13:00:00Z", { visit: { completada: true } });
  const other = await fixture(techB, "2030-06-20T13:00:00Z", { visit: { completada: true } });
  const data = await result(await query(techA), 200);
  assert.ok(data.sinProximaVisita.some(w => w.id === mine.work.id)); assert.ok(!data.sinProximaVisita.some(w => w.id === other.work.id));
  await prisma.visitaTecnica.create({ data: { trabajoId: mine.work.id, tecnicoId: techA.id, fechaProgramada: new Date("2030-06-22T13:00:00Z") } });
  assert.ok(!(await result(await query(techA), 200)).sinProximaVisita.some(w => w.id === mine.work.id));
  assert.equal((await result(await query(outsider), 200)).visitas.length, 0);
});

function noFinancialData(value) {
  const serialized = JSON.stringify(value);
  for (const key of ["cotizaciones", "pagos", "egreso", "totalCotizado", "anticipoMinimoRequerido", "costoUnitario", "subtotalCosto", "costoPromedio", "precioVenta", "tarifas", "calculo", "pdfUrl", "snapshotCalculoJson"]) assert.ok(!serialized.includes('"' + key + '"'), key + " must stay private");
}
test("technician detail and list omit real financial data while managers retain access", async () => {
  const { work } = await fixture(techA, "2030-06-25T13:00:00Z", { work: { fechasSla: { gas: { aplica: true, calculo: { promedioPorMetro: "999" }, supervision: { estado: "APROBADO", criterio: "Medición correcta", tarifas: { materialVisto: 999 } }, proyecto: { incluido: true, estado: "EN_ELABORACION", documentosUrls: [] } } } } });
  await prisma.cotizacion.create({ data: { trabajoId: work.id, datosFormularioJson: {}, snapshotCalculoJson: {}, subtotalMateriales: 500, subtotalManoObra: 200, totalCotizado: 700, anticipoMinimoRequerido: 350, fechaVencimiento: new Date("2030-07-01") } });
  await prisma.pago.create({ data: { trabajoId: work.id, tipoPago: "ANTICIPO", monto: 350, registradoPorId: manager.id } });
  await prisma.materialEjecucion.create({ data: { trabajoId: work.id, descripcion: "Tubería", cantidad: 2, costoUnitario: 100, subtotalCosto: 200 } });
  const ctx = { params: Promise.resolve({ id: work.id }) };
  const tech = await result(await detail.GET(request(techA, undefined, undefined, "GET"), ctx), 200);
  noFinancialData(tech);
  assert.equal(tech.materiales[0].descripcion, "Tubería"); assert.equal(Number(tech.materiales[0].cantidad), 2);
  assert.deepEqual(tech.cliente.telefonos, client.telefonos);
  assert.equal(tech.fechasSla.gas.supervision.criterio, "Medición correcta");
  noFinancialData(await result(await works.GET(request(techA, undefined, undefined, "GET")), 200));
  const managed = await result(await detail.GET(request(manager, undefined, undefined, "GET"), ctx), 200);
  assert.equal(Number(managed.cotizaciones[0].totalCotizado), 700); assert.equal(Number(managed.pagos[0].monto), 350);
  await result(await detail.GET(request(techB, undefined, undefined, "GET"), ctx), 403);
});

test("technician inventory and consumption preserve quantities and hide internal cost", async () => {
  const location = await prisma.ubicacionInventario.create({ data: { nombre: "Tienda de prueba", tipo: "TIENDA", sucursalId: branch.id } });
  const product = await prisma.productoInventario.create({ data: { codigoSku: randomUUID(), nombre: "Codo", categoria: "Accesorios", unidadMedida: "un", stockActual: 10, costoPromedio: 123, precioVenta: 456 } });
  await prisma.existenciaInventario.create({ data: { productoId: product.id, ubicacionId: location.id, stockActual: 10 } });
  const query = "?ubicacionId=" + location.id;
  const available = await result(await inventory.GET(request(techA, undefined, undefined, "GET", query)), 200);
  noFinancialData(available); assert.equal(available.find(p => p.id === product.id).stockActual, 10);
  const managed = await result(await inventory.GET(request(manager, undefined, undefined, "GET", query)), 200);
  assert.equal(Number(managed.find(p => p.id === product.id).precioVenta), 456);
  const { work } = await fixture(techA, "2030-06-26T13:00:00Z", { work: { estado: "EN_PROCESO" } });
  const ctx = { params: Promise.resolve({ id: work.id }) };
  const consumed = await result(await execution.POST(request(techA, { accion: "REGISTRAR_MATERIAL", data: { descripcion: "Codo", cantidad: 2, costoUnitario: 9999, esDeInventario: true, productoId: product.id, ubicacionId: location.id } }), ctx), 200);
  noFinancialData(consumed);
  const saved = await prisma.materialEjecucion.findUnique({ where: { id: consumed.material.id } });
  assert.equal(Number(saved.costoUnitario), 123); assert.equal(Number(saved.subtotalCosto), 246);
  assert.equal(Number((await prisma.productoInventario.findUnique({ where: { id: product.id } })).stockActual), 8);
  await result(await execution.POST(request(techA, { accion: "REGISTRAR_MATERIAL", data: { descripcion: "Compra externa", cantidad: 1, costoUnitario: 1, esDeInventario: false } }), ctx), 403);
  const finished = await result(await execution.POST(request(techA, { accion: "FINALIZAR_TECNICO", data: { observacionesTermino: "Pruebas realizadas correctamente", fotosTermino: ["https://example.invalid/fin1.jpg", "https://example.invalid/fin2.jpg"] } }), ctx), 200);
  assert.deepEqual(Object.keys(finished.trabajo).sort(), ["estado", "id"]);
});

test("technical evaluation response never returns pricing metadata stored in work", async () => {
  const { work, visit } = await fixture(techA, "2030-06-27T13:00:00Z", { work: { fechasSla: { gas: { aplica: true, supervision: { estado: "APROBADO", tarifas: { materialVisto: 999 } } } } } });
  const response = await result(await visits.POST(request(techA, { accion: "COMPLETAR_VISITA", visitaId: visit.id, medidasJson: { metrosVisto: 12, metrosEmpotrado: 3 }, condicionesJson: { condiciones: "Acceso al recinto adecuado" }, ventilacionVasaOk: true, dificultadSugerida: 2, fotosUrls: [1,2,3].map(i => "https://example.invalid/foto" + i + ".jpg") }), { params: Promise.resolve({ id: work.id }) }), 200);
  assert.deepEqual(Object.keys(response.trabajo).sort(), ["estado", "id"]);
  assert.equal(response.trabajo.estado, "EVALUADO");
});

test("technicians cannot retrieve prices through commercial endpoints", async () => {
  for (const [path, method] of [["dashboard/stats", "GET"], ["catalogo/servicios", "GET"], ["configuracion/precios", "GET"], ["finanzas", "GET"], ["cotizador/calcular", "POST"], ["trabajos/[id]/cotizacion", "POST"], ["trabajos/[id]/pagos", "POST"], ["trabajos/[id]/cierre-financiero", "POST"]]) {
    const route = require("../src/app/api/" + path + "/route.ts");
    await result(await route[method](request(techA, {}, undefined, method), { params: Promise.resolve({ id: randomUUID() }) }), 403);
  }
});

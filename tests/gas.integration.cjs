const { test, before, after } = require("node:test");
const assert = require("node:assert/strict"); const { randomUUID } = require("node:crypto");
const fs = require("node:fs"); const path = require("node:path");
const { PrismaClient } = require("@prisma/client"); const { NextRequest } = require("next/server"); const jwt = require("jsonwebtoken");

const supplied = process.env.TEST_DATABASE_URL;
if (!supplied) throw new Error("Configura TEST_DATABASE_URL con PostgreSQL local terminado en _test.");
const base = new URL(supplied);
if (!["localhost", "127.0.0.1"].includes(base.hostname) || !base.pathname.endsWith("_test")) throw new Error("Solo se permiten bases de pruebas locales.");
const schema = "gas_test_" + randomUUID().replaceAll("-", "");
const root = new PrismaClient({ datasources: { db: { url: base.toString() } } });
const scoped = new URL(base); scoped.searchParams.set("schema", schema); process.env.DATABASE_URL = scoped.toString(); process.env.JWT_SECRET = "catalog-local-integration-secret-only";
const { prisma } = require("../src/lib/prisma.ts");
const route = require("../src/app/api/trabajos/[id]/gas/route.ts");
const quotes = require("../src/app/api/trabajos/[id]/cotizacion/route.ts");
const closing = require("../src/app/api/trabajos/[id]/cierre-financiero/route.ts");
const visits = require("../src/app/api/trabajos/[id]/visita/route.ts");
const decisions = require("../src/app/api/trabajos/[id]/decision/route.ts");
const { newGasProject } = require("../src/lib/gas-data.ts");
const works = require("../src/app/api/trabajos/route.ts");
let admin, manager, branch, technician, outsider, client;
function req(user, body, method = "POST") { return new NextRequest("http://localhost/api/catalogo/servicios", { method, headers: { "Content-Type": "application/json", ...(user ? { Cookie: "servigaz_token=" + jwt.sign({ id: user.id }, process.env.JWT_SECRET) } : {}) }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) }); }
async function body(response, status = 200) { const data = await response.json(); assert.equal(response.status, status, JSON.stringify(data)); return data; }
before(async () => {
  await root.$executeRawUnsafe('CREATE SCHEMA "' + schema + '"');
  const sql = fs.readFileSync(path.join(__dirname, "fixtures/inventory-baseline.sql"), "utf8");
  await prisma.$transaction(async tx => { for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement); }, { timeout: 60000 });
  branch = await prisma.sucursal.create({ data: { nombre: "Sucursal catálogo de prueba" } });
  async function user(role) { return prisma.usuario.create({ data: { nombre: role, email: randomUUID() + "@example.invalid", rol: role, passwordHash: "not-a-password", sucursalId: branch.id } }); }
  admin = await user("ADMIN"); manager = await user("ENCARGADO"); technician = await user("TECNICO_FIJO");
  const other = await prisma.sucursal.create({ data: { nombre: "Otra sucursal" } });
  outsider = await prisma.usuario.create({ data: { nombre: "Externo", email: randomUUID() + "@example.invalid", rol: "ENCARGADO", passwordHash: "none", sucursalId: other.id } });
  client = await prisma.cliente.create({ data: { nombreCompleto: "Cliente gas", direccion: "Calle de prueba 123", telefonos: ["76543210"], sucursalId: branch.id } });
  await prisma.configuracionGarantia.create({ data: { subtipoCodigo: "1.1.1", mesesDefecto: 12, condiciones: "Condiciones de prueba", modificadoPor: admin.id } });
}, { timeout: 60000 });
after(async () => { await prisma.$disconnect(); if (/^gas_test_[a-f0-9]{32}$/.test(schema)) await root.$executeRawUnsafe('DROP SCHEMA "' + schema + '" CASCADE'); await root.$disconnect(); });


const rates = { materialVisto: 10.25, materialEmpotrado: 20.5, manoObraVisto: 5, manoObraEmpotrado: 10, factorManoObra: 1.5, importeProyecto: 100 };
const quoteInput = { subtotalMateriales: 1, subtotalManoObra: 1, montoTransporte: 20, totalCotizado: 2, carta: { alcance: "Instalación con tubería vista y empotrada según visita técnica.", condiciones: "No incluye obras adicionales.", fechaValidez: new Date(Date.now() + 20 * 86400000).toISOString() } };
const context = work => ({ params: Promise.resolve({ id: work.id }) });
async function fixture(included = true) {
  const work = await prisma.trabajo.create({ data: { codigoCorrelativo: "GAS-" + randomUUID(), clienteId: client.id, encargadoId: manager.id, tecnicoId: technician.id, sucursalId: branch.id, tipoFlujo: "COMPLETO", subtipoCodigo: "1.1.1", subtipoNombre: "Instalación de gas", estado: "EVALUADO", fechasSla: { preferenciaCliente: { desde: "10:00" }, gas: { aplica: true, proyecto: newGasProject(included) } } } });
  const visit = await prisma.visitaTecnica.create({ data: { trabajoId: work.id, tecnicoId: technician.id, fechaProgramada: new Date(), fechaEjecutada: new Date(), completada: true, medidasJson: { metrosVisto: 10, metrosEmpotrado: 5 }, condicionesJson: { condiciones: "Acceso verificado", agenda: { duracionMinutos: 60 } }, fotosUrls: ["https://example.invalid/a", "https://example.invalid/b", "https://example.invalid/c"] } });
  return { work, visit };
}
const approval = visit => ({ accion: "REVISAR_MEDICION", decision: "APROBAR", visitaId: visit.id, criterio: "Medición revisada; dificultad por acceso al trazado empotrado.", tarifas: rates, metrosVisto: 999 });
async function approve(work, visit, actor = manager) { return body(await route.POST(req(actor, approval(visit)), context(work))); }
async function issue(work, patch = {}) { return body(await quotes.POST(req(manager, { ...quoteInput, ...patch }), context(work))); }
const projectUpdate = estado => ({ accion: "ACTUALIZAR_PROYECTO", estado, responsable: "Responsable de proyecto", fechaObjetivo: "2030-01-01", referencia: "PROY-001", observaciones: "Avance revisado y registrado.", documentosUrls: ["https://example.invalid/proyecto.pdf"] });

test("gas quote requires independent supervisor review and branch access", async () => {
  const { work, visit } = await fixture();
  await body(await quotes.POST(req(manager, quoteInput), context(work)), 409);
  await body(await route.POST(req(technician, approval(visit)), context(work)), 403);
  await body(await route.POST(req(outsider, approval(visit)), context(work)), 403);
  await prisma.visitaTecnica.update({ where: { id: visit.id }, data: { tecnicoId: manager.id } });
  await body(await route.POST(req(manager, approval(visit)), context(work)), 403);
  await prisma.visitaTecnica.update({ where: { id: visit.id }, data: { tecnicoId: technician.id } });
  const result = await approve(work, visit, admin);
  assert.equal(result.gas.supervision.metrosVisto, 10); assert.equal(result.gas.supervision.supervisorId, admin.id);
  assert.equal((await prisma.trabajo.findUnique({ where: { id: work.id } })).fechasSla.preferenciaCliente.desde, "10:00");
});

test("quote uses exact measured rates and freezes letter, author, expiry and project fee", async () => {
  const { work, visit } = await fixture(); await approve(work, visit);
  const { cotizacion: quote } = await issue(work);
  assert.equal(Number(quote.subtotalMateriales), 205); assert.equal(Number(quote.subtotalManoObra), 250);
  assert.equal(Number(quote.totalCotizado), 475); assert.equal(Number(quote.anticipoMinimoRequerido), 237.5);
  assert.equal(quote.snapshotCalculoJson.gas.manoObraLineal, "150.00");
  assert.equal(quote.snapshotCalculoJson.gas.importeProyecto, "100.00");
  assert.equal(quote.snapshotCalculoJson.gas.promedioPorMetro, "23.67");
  assert.equal(quote.datosFormularioJson.carta.clienteNombre, "Cliente gas");
  assert.equal(quote.fechaVencimiento, quoteInput.carta.fechaValidez);
  await prisma.cliente.update({ where: { id: client.id }, data: { nombreCompleto: "Nombre posterior" } });
  assert.equal((await prisma.cotizacion.findUnique({ where: { id: quote.id } })).datosFormularioJson.carta.clienteNombre, "Cliente gas");
  await prisma.cliente.update({ where: { id: client.id }, data: { nombreCompleto: "Cliente gas" } });
  await body(await quotes.POST(req(manager, { ...quoteInput, carta: { ...quoteInput.carta, fechaValidez: "2020-01-01T00:00:00Z" } }), context(work)), 400);
});

test("changed measurement invalidates the old approval and cannot forge a quote", async () => {
  const { work, visit } = await fixture(); await approve(work, visit);
  await prisma.visitaTecnica.update({ where: { id: visit.id }, data: { medidasJson: { metrosVisto: 11, metrosEmpotrado: 5 } } });
  await body(await quotes.POST(req(manager, quoteInput), context(work)), 409);
  await approve(work, visit); assert.equal(Number((await issue(work)).cotizacion.subtotalMateriales), 215.25);
});

test("scope changes supersede quotes and force new approval before acceptance", async () => {
  const { work, visit } = await fixture(false); await approve(work, visit); const { cotizacion } = await issue(work);
  await body(await route.POST(req(manager, { accion: "INCLUIR_PROYECTO", incluido: true }), context(work)));
  assert.equal((await prisma.cotizacion.findUnique({ where: { id: cotizacion.id } })).estado, "SUPERADA");
  await body(await quotes.POST(req(manager, quoteInput), context(work)), 409);
  await approve(work, visit); const revised = (await issue(work)).cotizacion;
  assert.equal(revised.numeroVersion, 2); assert.equal(Number(revised.totalCotizado), 475);
  await prisma.cotizacion.update({ where: { id: revised.id }, data: { estado: "APROBADA" } });
  await body(await route.POST(req(manager, { accion: "INCLUIR_PROYECTO", incluido: false }), context(work)), 409);
});

test("correction returns evaluation to technician, preserves agenda, and requires new approval", async () => {
  const { work, visit } = await fixture(); await approve(work, visit); await issue(work);
  await body(await route.POST(req(manager, { ...approval(visit), decision: "CORREGIR", criterio: "Corregir metros empotrados y adjuntar nueva evidencia." }), context(work)));
  assert.equal((await prisma.trabajo.findUnique({ where: { id: work.id } })).estado, "EVALUACION_PENDIENTE");
  assert.equal((await prisma.visitaTecnica.findUnique({ where: { id: visit.id } })).completada, false);
  await body(await visits.POST(req(technician, { accion: "GUARDAR_EVALUACION", visitaId: visit.id, medidasJson: { metrosVisto: 12, metrosEmpotrado: 5 }, condicionesJson: { condiciones: "Recorrido corregido" }, ventilacionVasaOk: true, fotosUrls: ["https://example.invalid/a", "https://example.invalid/b", "https://example.invalid/c"], dificultadSugerida: 2 }), context(work)));
  const stored = await prisma.visitaTecnica.findUnique({ where: { id: visit.id } }); assert.equal(stored.condicionesJson.agenda.duracionMinutos, 60);
  await body(await quotes.POST(req(manager, quoteInput), context(work)), 409);
  await approve(work, visit); assert.equal(Number((await issue(work)).cotizacion.subtotalMateriales), 225.5);
});

test("project follows stages, allows observation cycle and prevents final close until delivery", async () => {
  const { work, visit } = await fixture(); await approve(work, visit); const quote = (await issue(work)).cotizacion;
  await prisma.cotizacion.update({ where: { id: quote.id }, data: { estado: "APROBADA" } });
  await prisma.trabajo.update({ where: { id: work.id }, data: { estado: "VALIDADO" } });
  await prisma.pago.create({ data: { trabajoId: work.id, tipoPago: "PAGO_TOTAL", monto: quote.totalCotizado, registradoPorId: manager.id } });
  const closeBody = { costoManoObraReal: 100, costoTransporteReal: 20 };
  const blocked = await body(await closing.POST(req(manager, closeBody), context(work)), 409); assert.match(blocked.error, /proyecto.*entregado/);
  await body(await route.POST(req(manager, projectUpdate("ENTREGADO")), context(work)), 409);
  await body(await route.POST(req(manager, { ...projectUpdate("EN_ELABORACION"), documentosUrls: ["javascript:alert(1)"] }), context(work)), 400);
  for (const stage of ["EN_ELABORACION", "EN_REVISION", "OBSERVADO", "EN_ELABORACION", "EN_REVISION", "PRESENTADO", "APROBADO", "ENTREGADO"]) await body(await route.POST(req(manager, projectUpdate(stage)), context(work)));
  const result = await body(await closing.POST(req(manager, closeBody), context(work))); assert.ok(result.garantia); assert.equal(result.utilidadReal, 355);
  assert.equal(await prisma.auditoriaLog.count({ where: { entidadId: work.id, modulo: "PROYECTO_GAS" } }), 8);
});

test("approval retry preserves the issued version and no-project quote excludes its fee", async () => {
  const { work, visit } = await fixture(false); await approve(work, visit); const quote = (await issue(work)).cotizacion;
  assert.equal(Number(quote.totalCotizado), 375); assert.equal(quote.snapshotCalculoJson.gas.importeProyecto, "0.00");
  await approve(work, visit);
  assert.equal((await prisma.cotizacion.findUnique({ where: { id: quote.id } })).estado, "VIGENTE");
  assert.equal((await prisma.trabajo.findUnique({ where: { id: work.id } })).estado, "COTIZADO");
});

test("rates and measurements reject invalid precision before a review or quotation is committed", async () => {
  const { work, visit } = await fixture();
  await body(await route.POST(req(manager, { ...approval(visit), tarifas: { ...rates, materialVisto: 1.001 } }), context(work)), 400);
  await prisma.visitaTecnica.update({ where: { id: visit.id }, data: { medidasJson: { metrosVisto: 10.123, metrosEmpotrado: 5 } } });
  await body(await route.POST(req(manager, approval(visit)), context(work)), 409);
  assert.equal(await prisma.auditoriaLog.count({ where: { entidadId: work.id, modulo: "SUPERVISION_GAS" } }), 0);
});

test("wizard persists optional gas project and refuses it for another service", async () => {
  const category = await prisma.catalogoCategoria.create({ data: { nombre: "Gas", codigo: "GAS", requiereVisita: true } });
  await prisma.catalogoSubtipo.create({ data: { nombre: "Instalación", codigo: "GAS_TEST", categoriaId: category.id } });
  const input = { clienteId: client.id, subtipoCodigo: "GAS_TEST", subtipoCodigos: ["GAS_TEST"], subtipoNombre: "Instalación", tipoFlujo: "COMPLETO", incluyeProyectoGas: true };
  const work = await body(await works.POST(req(manager, input)), 201);
  assert.equal(work.estado, "BORRADOR"); assert.equal(work.fechasSla.gas.proyecto.incluido, true); assert.equal(work.fechasSla.gas.proyecto.estado, "PENDIENTE");
  const other = await prisma.catalogoCategoria.create({ data: { nombre: "Otro", codigo: "OTRO" } });
  await prisma.catalogoSubtipo.create({ data: { nombre: "Servicio", codigo: "OTHER_TEST", categoriaId: other.id } });
  await body(await works.POST(req(manager, { ...input, subtipoCodigo: "OTHER_TEST", subtipoCodigos: ["OTHER_TEST"] })), 400);
});

test("only managers and admins issue quotes, with their own frozen name and legacy audit attribution", async () => {
  const detail = require("../src/app/api/trabajos/[id]/route.ts");
  await prisma.usuario.update({ where: { id: manager.id }, data: { nombre: "Ana Pérez" } });
  await prisma.usuario.update({ where: { id: admin.id }, data: { nombre: "Luis Torres" } });
  for (const [actor, name] of [[manager, "Ana Pérez"], [admin, "Luis Torres"]]) {
    const { work, visit } = await fixture(); await approve(work, visit);
    await body(await quotes.POST(req(technician, quoteInput), context(work)), 403);
    assert.equal(await prisma.cotizacion.count({ where: { trabajoId: work.id } }), 0);
    const { cotizacion } = await body(await quotes.POST(req(actor, { ...quoteInput, datosFormulario: { carta: { cotizadoPorNombre: "Firma falsa" } }, carta: { ...quoteInput.carta, cotizadoPorNombre: "Otra persona" } }), context(work)));
    assert.equal(cotizacion.datosFormularioJson.carta.cotizadoPorNombre, name);
    assert.equal(cotizacion.datosFormularioJson.carta.cotizadoPorId, actor.id);
    await prisma.usuario.update({ where: { id: actor.id }, data: { nombre: "Nombre cambiado" } });
    const frozen = await body(await detail.GET(req(manager, undefined, "GET"), context(work)));
    assert.equal(frozen.cotizaciones[0].emitidoPorNombre, name);
    await prisma.usuario.update({ where: { id: actor.id }, data: { nombre: name } });
    const { cotizadoPorId, cotizadoPorNombre, ...legacyLetter } = cotizacion.datosFormularioJson.carta;
    await prisma.cotizacion.update({ where: { id: cotizacion.id }, data: { datosFormularioJson: { carta: legacyLetter } } });
    const legacy = await body(await detail.GET(req(manager, undefined, "GET"), context(work)));
    assert.equal(legacy.cotizaciones[0].emitidoPorNombre, name);
  }
});

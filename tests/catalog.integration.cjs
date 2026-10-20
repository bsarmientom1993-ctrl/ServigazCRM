const { test, before, after } = require("node:test");
const assert = require("node:assert/strict"); const { randomUUID } = require("node:crypto");
const fs = require("node:fs"); const path = require("node:path");
const { PrismaClient } = require("@prisma/client"); const { NextRequest } = require("next/server"); const jwt = require("jsonwebtoken");
const { configureExampleCatalog } = require("../src/lib/catalog-examples.cjs");
const supplied = process.env.TEST_DATABASE_URL;
if (!supplied) throw new Error("Configura TEST_DATABASE_URL con PostgreSQL local terminado en _test.");
const base = new URL(supplied);
if (!["localhost", "127.0.0.1"].includes(base.hostname) || !base.pathname.endsWith("_test")) throw new Error("Solo se permiten bases de pruebas locales.");
const schema = "catalog_test_" + randomUUID().replaceAll("-", "");
const root = new PrismaClient({ datasources: { db: { url: base.toString() } } });
const scoped = new URL(base); scoped.searchParams.set("schema", schema); process.env.DATABASE_URL = scoped.toString(); process.env.JWT_SECRET = "catalog-local-integration-secret-only";
const { prisma } = require("../src/lib/prisma.ts");
const route = require("../src/app/api/catalogo/servicios/route.ts");
const works = require("../src/app/api/trabajos/route.ts");
let admin, manager, branch;
function req(user, body, method = "POST") { return new NextRequest("http://localhost/api/catalogo/servicios", { method, headers: { "Content-Type": "application/json", ...(user ? { Cookie: "servigaz_token=" + jwt.sign({ id: user.id }, process.env.JWT_SECRET) } : {}) }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) }); }
async function body(response, status = 200) { const data = await response.json(); assert.equal(response.status, status, JSON.stringify(data)); return data; }
before(async () => {
  await root.$executeRawUnsafe('CREATE SCHEMA "' + schema + '"');
  const sql = fs.readFileSync(path.join(__dirname, "fixtures/inventory-baseline.sql"), "utf8");
  await prisma.$transaction(async tx => { for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement); }, { timeout: 60000 });
  branch = await prisma.sucursal.create({ data: { nombre: "Sucursal catálogo de prueba" } });
  async function user(role) { return prisma.usuario.create({ data: { nombre: role, email: randomUUID() + "@example.invalid", rol: role, passwordHash: "not-a-password", sucursalId: branch.id } }); }
  admin = await user("ADMIN"); manager = await user("ENCARGADO");
}, { timeout: 60000 });
after(async () => { await prisma.$disconnect(); if (/^catalog_test_[a-f0-9]{32}$/.test(schema)) await root.$executeRawUnsafe('DROP SCHEMA "' + schema + '" CASCADE'); await root.$disconnect(); });

test("empty catalog receives seven categories and fifteen selectable services", async () => {
  const summary = await configureExampleCatalog(prisma, { once: true });
  assert.equal(summary.categoriasCreadas, 7); assert.equal(summary.serviciosCreados, 15);
  const catalog = await body(await route.GET(req(admin, undefined, "GET")));
  assert.deepEqual(catalog.map(c => c.codigo).sort(), ["GAS", "CALEFACCION", "PLOMERIA", "OTROS", "MANTENIMIENTO", "PROVISION", "PROVISION_INSTALACION"].sort());
  assert.equal(catalog.reduce((sum, c) => sum + c.subtipos.length, 0), 15);
  assert.equal(await prisma.configuracionPrecio.count(), 0); assert.equal(await prisma.configuracionManoObra.count(), 0);
});
test("deployment and manual repeats do not duplicate catalog entries or audit", async () => {
  assert.equal((await configureExampleCatalog(prisma, { once: true })).yaConfigurado, true);
  assert.equal((await configureExampleCatalog(prisma, { userId: admin.id })).serviciosCreados, 0);
  assert.equal(await prisma.catalogoCategoria.count(), 7); assert.equal(await prisma.catalogoSubtipo.count(), 15);
  assert.equal(await prisma.auditoriaLog.count({ where: { entidadTipo: "CatalogoEjemplos" } }), 2);
});
test("custom names, visit settings, inactive services and prices remain unchanged", async () => {
  const gas = await prisma.catalogoCategoria.update({ where: { codigo: "GAS" }, data: { nombre: "Gas personalizado", requiereVisita: false } });
  await prisma.catalogoSubtipo.update({ where: { codigo: "1.1.1" }, data: { nombre: "Servicio personalizado", activo: false } });
  const price = await prisma.configuracionPrecio.create({ data: { subtipoCodigo: "1.1.1", concepto: "Material de prueba", precioUnitario: 123, unidad: "unidad", modificadoPor: admin.id } });
  await configureExampleCatalog(prisma, { userId: admin.id });
  const category = await prisma.catalogoCategoria.findUnique({ where: { id: gas.id } });
  const subtype = await prisma.catalogoSubtipo.findUnique({ where: { codigo: "1.1.1" } });
  assert.equal(category.nombre, "Gas personalizado"); assert.equal(category.requiereVisita, false);
  assert.equal(subtype.nombre, "Servicio personalizado"); assert.equal(subtype.activo, false);
  assert.equal(Number((await prisma.configuracionPrecio.findUnique({ where: { id: price.id } })).precioUnitario), 123);
});
test("inactive categories remain inactive without receiving new services", async () => {
  await prisma.catalogoCategoria.update({ where: { codigo: "CALEFACCION" }, data: { activo: false } });
  await prisma.catalogoSubtipo.delete({ where: { codigo: "1.2.1" } });
  const summary = await configureExampleCatalog(prisma, { userId: admin.id });
  assert.equal(summary.categoriasInactivas, 1); assert.equal(await prisma.catalogoSubtipo.findUnique({ where: { codigo: "1.2.1" } }), null);
});
test("an existing service code assigned elsewhere is never moved", async () => {
  const category = await prisma.catalogoCategoria.create({ data: { nombre: "Propia", codigo: "PROPIA" } });
  await prisma.catalogoSubtipo.update({ where: { codigo: "1.3.3" }, data: { categoriaId: category.id } });
  await configureExampleCatalog(prisma, { userId: admin.id });
  assert.equal((await prisma.catalogoSubtipo.findUnique({ where: { codigo: "1.3.3" } })).categoriaId, category.id);
});
test("subsequent deploys preserve removals while an explicit admin completion adds missing entries once", async () => {
  await prisma.catalogoSubtipo.delete({ where: { codigo: "1.3.2" } });
  await configureExampleCatalog(prisma, { once: true });
  assert.equal(await prisma.catalogoSubtipo.findUnique({ where: { codigo: "1.3.2" } }), null);
  const results = await Promise.all([configureExampleCatalog(prisma, { userId: admin.id }), configureExampleCatalog(prisma, { userId: admin.id })]);
  assert.equal(results.reduce((sum, result) => sum + result.serviciosCreados, 0), 1);
  assert.equal(await prisma.catalogoSubtipo.count({ where: { codigo: "1.3.2" } }), 1);
});
test("an audit failure rolls back catalog additions", async () => {
  await prisma.catalogoSubtipo.delete({ where: { codigo: "1.1.2" } });
  await assert.rejects(configureExampleCatalog(prisma, { userId: "nonexistent-user" }));
  assert.equal(await prisma.catalogoSubtipo.findUnique({ where: { codigo: "1.1.2" } }), null);
});
test("only an authenticated admin can complete the catalog from configuration", async () => {
  await body(await route.POST(req(null, { accion: "CARGAR_EJEMPLOS" })), 401);
  await body(await route.POST(req(manager, { accion: "CARGAR_EJEMPLOS" })), 403);
  const result = await body(await route.POST(req(admin, { accion: "CARGAR_EJEMPLOS" })));
  assert.equal(result.resumen.serviciosCreados, 1);
  const audit = await prisma.auditoriaLog.findFirst({ where: { entidadTipo: "CatalogoEjemplos", usuarioId: admin.id }, orderBy: { timestamp: "desc" } });
  assert.equal(audit.valoresNuevos.origen, "ADMINISTRADOR");
});
test("a configured service can create a real work request through the wizard API", async () => {
  const work = await body(await works.POST(req(manager, { nuevoCliente: { nombreCompleto: "Cliente catálogo prueba", telefono: "76543210", direccion: "Calle 123" }, subtipoCodigo: "1.3.1", subtipoCodigos: ["1.3.1"], subtipoNombre: "Instalación de red de agua", tipoFlujo: "COMPLETO" })), 201);
  assert.equal(work.estado, "BORRADOR"); assert.equal(work.subtipoCodigo, "1.3.1"); assert.equal(work.subtipoNombre, "Instalación de red de agua");
});

test("new services create the right registration flow without gas-meter approval for maintenance or supply", async () => {
  for (const [code, flow, state] of [["MANT.CALEFON", "SIMPLIFICADO", "EVALUADO"], ["EQUIPO.PROVISION", "SIMPLIFICADO", "EVALUADO"], ["EQUIPO.INSTALACION", "COMPLETO", "BORRADOR"]]) {
    const work = await body(await works.POST(req(manager, { nuevoCliente: { nombreCompleto: "Cliente nuevo servicio", telefono: "76543210", direccion: "Calle 456" }, subtipoCodigo: code, subtipoCodigos: [code], subtipoNombre: "Texto no confiable", tipoFlujo: flow })), 201);
    assert.equal(work.tipoFlujo, flow); assert.equal(work.estado, state);
    assert.ok(!work.fechasSla?.gas); assert.notEqual(work.subtipoNombre, "Texto no confiable");
  }
  await body(await works.POST(req(manager, { nuevoCliente: { nombreCompleto: "Cliente instalación", telefono: "76543210", direccion: "Calle 456" }, subtipoCodigo: "EQUIPO.INSTALACION", subtipoCodigos: ["EQUIPO.INSTALACION"], subtipoNombre: "Instalación", tipoFlujo: "SIMPLIFICADO" })), 400);
});

test("upgrade from v1 adds only new services without restoring removed original entries", async () => {
  await prisma.auditoriaLog.deleteMany({ where: { entidadTipo: "CatalogoEjemplos", entidadId: "catalogo-ejemplos-v2" } });
  await prisma.catalogoSubtipo.deleteMany({ where: { codigo: { in: ["MANT.CALEFON", "EQUIPO.PROVISION", "EQUIPO.INSTALACION", "OTR.REVISION"] } } });
  const result = await configureExampleCatalog(prisma, { once: true });
  assert.equal(result.serviciosCreados, 3);
  assert.equal(await prisma.catalogoSubtipo.findUnique({ where: { codigo: "OTR.REVISION" } }), null);
  assert.equal((await configureExampleCatalog(prisma, { once: true })).yaConfigurado, true);
});

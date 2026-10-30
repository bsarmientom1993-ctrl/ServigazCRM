const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { NextRequest } = require("next/server");
const jwt = require("jsonwebtoken");
const { Prisma } = require("@prisma/client");
const db = {};
const load = Module._load;
Module._load = function(request, parent, ...args) {
  if (request === "@/lib/prisma" || (parent?.filename.endsWith(path.join("lib", "auth.ts")) && request === "./prisma") ||
      (parent?.filename.endsWith(path.join("lib", "workflow.ts")) && request === "./prisma")) return { prisma: db };
  return load.call(this, request, parent, ...args);
};
process.env.JWT_SECRET = "test-secret-only-for-workflow-regression-tests";
const { cents, paymentResult, assertStart, assertClose } = require("../src/lib/workflow-policy.ts");
const { assertWorkAccess } = require("../src/lib/auth.ts");
const payments = require("../src/app/api/trabajos/[id]/pagos/route.ts");
const decision = require("../src/app/api/trabajos/[id]/decision/route.ts");
const execution = require("../src/app/api/trabajos/[id]/ejecucion/route.ts");
const closure = require("../src/app/api/trabajos/[id]/cierre-financiero/route.ts");
const visits = require("../src/app/api/trabajos/[id]/visita/route.ts");
const quoteRoute = require("../src/app/api/trabajos/[id]/cotizacion/route.ts");
const setup = require("../src/app/api/setup/route.ts");
let user, work, tx, writes, transactions, previous;
const decimal = value => new Prisma.Decimal(value);
const context = { params: Promise.resolve({ id: "work-1" }) };
function request(body, options = {}) {
  const headers = { "Content-Type": "application/json", "Idempotency-Key": options.key || randomUUID() };
  if (options.auth !== false) headers.Cookie = "servigaz_token=" + jwt.sign({ id: user.id, rol: options.tokenRole || user.rol }, process.env.JWT_SECRET, { algorithm: "HS256" });
  return new NextRequest("http://localhost/api/trabajos/work-1", { method: "POST", headers, body: JSON.stringify(body) });
}
beforeEach(() => {
  user = { id: "manager-1", rol: "ENCARGADO", estado: "ACTIVO", sucursalId: "branch-1" };
  work = { id: "work-1", estado: "APROBADO", tecnicoId: "tech-1", encargadoId: "manager-1", sucursalId: "branch-1",
    codigoCorrelativo: "TRB-2026-0001", subtipoCodigo: "3.3", tipoFlujo: "COMPLETO", subtipoNombre: "Diagnóstico",
    pagos: [], materiales: [], egreso: null, garantia: null,
    cotizaciones: [{ id: "quote-1", numeroVersion: 1, estado: "APROBADA", totalCotizado: decimal(1000), anticipoMinimoRequerido: decimal(500), fechaVencimiento: new Date(Date.now() + 86400000) }] };
  writes = []; transactions = 0; previous = null;
  const writer = kind => async ({ data }) => { writes.push([kind, data]); return { id: randomUUID(), ...data }; };
  tx = {
    $queryRaw: async () => [{ id: work.id }],
    trabajo: { findUniqueOrThrow: async () => work, update: async ({ data }) => { writes.push(["work", data]); return { ...work, ...data }; } },
    pago: { findUnique: async () => previous, create: writer("payment") },
    usuario: { findUniqueOrThrow: async () => ({ id: user.id, nombre: "Ana Pérez" }), findUnique: async () => ({ id: "tech-1", nombre: "Ana Pérez", rol: "TECNICO_FIJO", estado: "ACTIVO", sucursalId: "branch-1" }) },
    auditoriaLog: { create: writer("audit"),findFirst:async()=>null },
    cotizacion: { update: writer("quote"), updateMany: async () => ({ count: 1 }), create: writer("quote") },
    configuracionGarantia: { findUnique: async () => ({ activo: true, mesesDefecto: 2, condiciones: "Cobertura del diagnóstico" }) },
    configuracionDescuento: { findFirst: async () => ({ pctMaxEncargado: decimal(10), topeMaximoPct: decimal(20) }) },
    formatoCotizacion: { findUnique: async () => null },
    configuracionAnticipo: { findUnique: async () => null },
    notificacion:{createMany:async()=>({count:0})},comisionTrabajo:{findUnique:async()=>null,create:writer("commission")}, configuracionComision:{findUnique:async()=>null},
    egresoTrabajo: { create: writer("expense") }, certificadoGarantia: { create: writer("warranty") },
    catalogoSubtipo: { findUnique: async () => ({ categoria: { codigo: "GAS" } }) },
    visitaTecnica: { findFirst: async () => null },
    entregaMaterialItem: {findMany:async()=>[],aggregate:async()=>({_sum:{cantidad:null,consumida:null,devuelta:null}})},
  };
  db.usuario = { findUnique: async () => user };
  db.$transaction = async fn => { transactions++; return fn(tx); };
});

test("partial payments accumulate and reach the minimum without changing execution state", () => {
  assert.equal(paymentResult("APROBADO", 100000, 50000, 0, 20000).nextState, "PAGO_A_CUENTA_RECIBIDO");
  assert.equal(paymentResult("PAGO_A_CUENTA_RECIBIDO", 100000, 50000, 20000, 30000).nextState, "ANTICIPO_RECIBIDO");
  assert.equal(paymentResult("EN_PROCESO", 100000, 50000, 50000, 20000).nextState, "EN_PROCESO");
});
test("100% direct-service payment satisfies minimum but does not imply acceptance", () => {
  assert.equal(paymentResult("COTIZADO", 18000, 18000, 0, 18000).nextState, "COTIZADO");
  assert.equal(paymentResult("APROBADO", 18000, 18000, 0, 18000).nextState, "ANTICIPO_RECIBIDO");
});
test("zero-balance, overpayment, negative and nonfinite amounts are rejected", () => {
  assert.throws(() => paymentResult("VALIDADO", 10000, 5000, 10000, 100));
  assert.throws(() => paymentResult("VALIDADO", 10000, 5000, 9000, 2000));
  for (const value of [NaN, Infinity, -1, 1.001, "", null, undefined]) assert.throws(() => cents(value));
  assert.equal(cents(0.29), 29);
});
test("start requires customer acceptance, assigned technician and sufficient deposit", () => {
  for (const args of [["COTIZADO", true, false, 50, 100], ["APROBADO", false, true, 50, 100], ["APROBADO", true, true, 50, 20]])
    assert.throws(() => assertStart(...args));
  assert.doesNotThrow(() => assertStart("APROBADO", true, true, 180, 180));
});
test("close requires validation and exact reconciliation, including overpayments", () => {
  for (const args of [["EN_PROCESO", 100, 100], ["VALIDADO", 100, 90], ["VALIDADO", 100, 110]]) assert.throws(() => assertClose(...args));
  assert.doesNotThrow(() => assertClose("VALIDADO", 100, 100));
});
test("technicians and branch managers cannot access unrelated orders", () => {
  assert.throws(() => assertWorkAccess({ ...user, rol: "TECNICO_FIJO", id: "other" }, work));
  assert.throws(() => assertWorkAccess({ ...user, id: "other", sucursalId: "other" }, work));
});

test("payment without session returns 401 before opening a transaction", async () => {
  const response = await payments.POST(request({ monto: 10, metodoPago: "EFECTIVO" }, { auth: false }), context);
  assert.equal(response.status, 401); assert.equal(transactions, 0);
});
test("inactive users cannot mutate orders", async () => {
  user.estado = "INACTIVO";
  assert.equal((await payments.POST(request({ monto: 10, metodoPago: "EFECTIVO" }), context)).status, 401);
  assert.equal(writes.length, 0);
});
test("current database role overrides stale admin token", async () => {
  user.rol = "TECNICO_FIJO";
  assert.equal((await payments.POST(request({ monto: 10, metodoPago: "EFECTIVO" }, { tokenRole: "ADMIN" }), context)).status, 403);
  assert.equal(writes.length, 0);
});
test("total payment records actual author, enables preparation, and audits accepted quote", async () => {
  const response = await payments.POST(request({ monto: 1000, metodoPago: "EFECTIVO" }), context);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).nuevoEstado, "ANTICIPO_RECIBIDO");
  assert.equal(writes.find(([type]) => type === "payment")[1].registradoPorId, user.id);
  assert.equal(writes.find(([type]) => type === "audit")[1].valoresNuevos.cotizacionId, "quote-1");
});
test("retry with same payment key returns prior result without a second write", async () => {
  const key = randomUUID();
  previous = { id: key, trabajoId: work.id, monto: decimal(1000), metodoPago: "EFECTIVO", numeroReferencia: "", comprobanteUrl: null, registradoPorId: user.id };
  work.pagos = [previous];
  const response = await payments.POST(request({ monto: 1000, metodoPago: "EFECTIVO" }, { key }), context);
  assert.equal(response.status, 200); assert.equal((await response.json()).yaRegistrado, true);
  assert.equal(writes.length, 0);
});
test("reusing a payment key with another amount returns conflict", async () => {
  const key = randomUUID();
  previous = { id: key, trabajoId: work.id, monto: decimal(1000), metodoPago: "EFECTIVO", numeroReferencia: "", comprobanteUrl: null, registradoPorId: user.id };
  assert.equal((await payments.POST(request({ monto: 500, metodoPago: "EFECTIVO" }, { key }), context)).status, 409);
  assert.equal(writes.length, 0);
});
test("accepting an already paid quote enables preparation without collecting again", async () => {
  work.estado = "COTIZADO"; work.cotizaciones[0].estado = "VIGENTE"; work.pagos = [{ monto: decimal(1000) }];
  const response = await decision.POST(request({ decision: "APROBAR", cotizacionId: "quote-1" }), context);
  assert.equal(response.status, 200); assert.equal((await response.json()).trabajo.estado, "ANTICIPO_RECIBIDO");
  assert.equal(writes.find(([type]) => type === "quote")[1].estado, "APROBADA");
});
test("accepting a replaced quote is rejected", async () => {
  work.estado = "COTIZADO"; work.cotizaciones[0].estado = "VIGENTE";
  assert.equal((await decision.POST(request({ decision: "APROBAR", cotizacionId: "old-quote" }), context)).status, 409);
  assert.equal(writes.length, 0);
});
test("rejection preserves commercial outcome rather than archiving as completed", async () => {
  work.estado = "COTIZADO"; work.cotizaciones[0].estado = "VIGENTE";
  const response = await decision.POST(request({ decision: "RECHAZAR", cotizacionId: "quote-1" }), context);
  assert.equal((await response.json()).trabajo.estado, "RECHAZADO");
});
test("insufficient deposit cannot start work through the API", async () => {
  const response = await execution.POST(request({ accion: "INICIAR_EJECUCION" }), context);
  assert.equal(response.status, 409); assert.equal(writes.length, 0);
});
test("a technician cannot approve their own quality", async () => {
  user.rol = "TECNICO_FIJO"; user.id = "tech-1"; work.estado = "TERMINADO_TECNICO";
  assert.equal((await execution.POST(request({ accion: "VALIDAR_ENCARGADO" }), context)).status, 403);
  assert.equal(writes.length, 0);
});
test("technical completion requires evidence and persists it for quality review", async () => {
  work.estado = "EN_PROCESO";
  assert.equal((await execution.POST(request({ accion: "FINALIZAR_TECNICO", data: { fotosTermino: [], observacionesTermino: "Probado" } }), context)).status, 400);
  const photos = ["https://example.com/work-before.jpg", "https://example.com/work-after.jpg"];
  const response = await execution.POST(request({ accion: "FINALIZAR_TECNICO", data: { fotosTermino: photos, observacionesTermino: "Prueba realizada y resultado registrado" } }), context);
  assert.equal(response.status, 200);
  assert.deepEqual(writes.find(([type]) => type === "audit")[1].valoresNuevos.fotosTermino, photos);
});
test("visit IDs from another order are rejected", async () => {
  work.estado = "EVALUACION_PENDIENTE";
  const response = await visits.POST(request({ accion: "COMPLETAR_VISITA", visitaId: "foreign-visit", medidasJson: { metrosVisto: 10, metrosEmpotrado: 5 },
    condicionesJson: { condiciones: "Acceso despejado" }, fotosUrls: ["https://example.com/a", "https://example.com/b", "https://example.com/c"], dificultadSugerida: 1, ventilacionVasaOk: true }), context);
  assert.equal(response.status, 409); assert.equal(writes.length, 0);
});
test("unpaid job cannot close or create a warranty", async () => {
  work.estado = "VALIDADO"; work.pagos = [{ monto: decimal(500) }];
  assert.equal((await closure.POST(request({ costoManoObraReal: 200, costoTransporteReal: 10 }), context)).status, 409);
  assert.equal(writes.length, 0);
});
test("closure freezes exact costs and uses service-specific warranty duration", async () => {
  work.estado = "VALIDADO"; work.pagos = [{ monto: decimal(1000) }];
  const response = await closure.POST(request({ costoManoObraReal: 200, costoTransporteReal: 10 }), context);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.utilidadReal, 790);
  assert.equal(data.garantia.mesesCobertura, 2);
  assert.equal(writes.filter(([type]) => ["expense", "warranty", "work", "audit"].includes(type)).length, 5);
});
test("closure retries return existing complete close without writing again", async () => {
  work.estado = "FINALIZADO_FINANCIERO"; work.egreso = { id: "closed", utilidadNeta: decimal(790) }; work.garantia = { id: "warranty" };
  const response = await closure.POST(request({ costoManoObraReal: 200, costoTransporteReal: 10 }), context);
  assert.equal(response.status, 200); assert.equal((await response.json()).yaCerrado, true); assert.equal(writes.length, 0);
});
test("an incomplete legacy close returns conflict instead of false success", async () => {
  work.estado = "FINALIZADO_FINANCIERO"; work.egreso = { utilidadNeta: decimal(100) };
  assert.equal((await closure.POST(request({ costoManoObraReal: 0, costoTransporteReal: 0 }), context)).status, 409);
});
test("quote totals and deposit are calculated on server, ignoring forged totals", async () => {
  work.estado = "EVALUADO"; work.cotizaciones = [];
  const response = await quoteRoute.POST(request({ subtotalMateriales: 100, subtotalManoObra: 100, montoTransporte: 0, porcentajeDescuento: 0, totalCotizado: 1, anticipoMinimo: 0 }), context);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.cotizacion.totalCotizado, "200.00");
  assert.equal(data.cotizacion.anticipoMinimoRequerido, "100.00");
});
test("manager cannot authorize an excessive discount", async () => {
  work.estado = "EVALUADO"; work.cotizaciones = [];
  assert.equal((await quoteRoute.POST(request({ subtotalMateriales: 100, subtotalManoObra: 100, montoTransporte: 0, porcentajeDescuento: 15 }), context)).status, 403);
  assert.equal(writes.length, 0);
});
test("public setup endpoint cannot reset credentials", async () => {
  assert.equal((await setup.GET()).status, 410); assert.equal(transactions, 0);
});


test("all internal handlers reject missing sessions before accessing business data", async () => {
  const routes = [
    ["atencion", ["GET"]], ["supervision", ["GET","POST"]], ["caja", ["GET","POST"]], ["auth/rol", ["POST"]], ["proformas", ["GET","POST","PATCH"]], ["proformas/opciones", ["GET","POST"]], ["entregas", ["GET","POST","PATCH"]],
    ["catalogo/servicios", ["GET", "POST"]], ["clientes", ["GET", "POST"]], ["clientes/[id]/historial", ["GET"]],
    ["equipo", ["GET"]], ["trabajos/[id]/responsables", ["POST"]], ["cotizaciones/pendientes", ["GET"]], ["gestion-tienda", ["GET", "PUT"]], ["configuracion/precios", ["GET", "POST"]], ["cotizador/calcular", ["POST"]],
    ["dashboard/stats", ["GET"]], ["finanzas", ["GET", "POST"]], ["finanzas/balance", ["GET"]],
    ["garantias", ["GET"]], ["garantias/[codigo]", ["POST"]], ["garantias/reclamo/[id]", ["PATCH"]],
    ["ubicaciones", ["GET", "POST"]], ["ubicaciones/[id]", ["PATCH"]],
    ["sucursales", ["GET", "POST"]], ["sucursales/[id]", ["PATCH"]],
    ["inventario/traspasos", ["GET", "POST", "PATCH"]], ["inventario/movimientos", ["GET"]], ["inventario/minimos", ["PATCH"]],
    ["inventario", ["GET", "POST"]], ["inventario/compras", ["GET", "POST"]], ["tecnicos", ["GET"]], ["tecnicos/disponibilidad", ["GET"]], ["tecnicos/mi-agenda", ["GET"]], ["fotos/trabajos", ["GET"]], ["trabajos/[id]/fotos", ["GET", "POST"]], ["trabajos/[id]/fotos/[fotoId]", ["GET"]], ["proyectos", ["GET"]], ["trabajos/[id]/proyecto", ["GET", "POST"]],
    ["trabajos", ["GET", "POST"]], ["trabajos/[id]", ["GET"]],
    ["usuarios", ["GET"]], ["usuarios/[id]", ["PATCH"]], ["auth/me", ["PATCH"]],
    ...["pagos", "decision", "ejecucion", "cierre-financiero", "visita", "cotizacion", "gas"].map(name => ["trabajos/[id]/" + name, ["POST"]]),
  ];
  for (const [name, methods] of routes) {
    const route = require("../src/app/api/" + name + "/route.ts");
    for (const method of methods) {
      const req = new NextRequest("http://localhost/api/" + name, { method, ...(method === "GET" ? {} : { body: "{}" }) });
      const response = await route[method](req, { params: Promise.resolve({ id: "work-1", codigo: "GAR-1" }) });
      assert.equal(response.status, 401, method + " " + name);
    }
  }
  assert.equal(transactions, 0);
});
test("inventory consumption uses server cost and a conditional decrement", async () => {
  work.estado = "EN_PROCESO";
  let condition;
  tx.ubicacionInventario = { findUnique: async () => ({ id: "location-1", activo: true, esInicial: false, sucursalId: user.sucursalId }) };
  tx.existenciaInventario = { aggregate: async () => ({ _sum: { stockActual: decimal(10) } }), upsert: async () => ({ id: "stock-1", stockActual: decimal(10) }),
    updateMany: async args => { condition = args; return { count: 1 }; } };
  tx.traspasoInventario = { aggregate: async () => ({ _sum: { cantidad: decimal(0) } }) };
  tx.productoInventario = { findUniqueOrThrow: async () => ({ id: "product-1", activo: true, stockActual: decimal(10), costoPromedio: decimal(12.50) }), update: async () => ({}) };
  tx.movimientoInventario = { create: async ({ data }) => { writes.push(["movement", data]); return data; } };
  tx.materialEjecucion = { create: async ({ data }) => { writes.push(["material", data]); return { id: "material-1", ...data }; } };
  const response = await execution.POST(request({ accion: "REGISTRAR_MATERIAL", data: {
    descripcion: "Tubo", ubicacionId: "location-1", cantidad: 2, costoUnitario: 0.01, esDeInventario: true, productoId: "product-1",
  } }), context);
  assert.equal(response.status, 200);
  assert.equal(String(condition.where.stockActual.gte), "2");
  assert.equal(String(condition.data.stockActual.decrement), "2");
  const material = writes.find(([type]) => type === "material")[1];
  assert.equal(String(material.costoUnitario), "12.5");
  assert.equal(String(material.subtotalCosto), "25");
});
test("insufficient stock never creates a material or inventory movement", async () => {
  work.estado = "EN_PROCESO";
  tx.ubicacionInventario = { findUnique: async () => ({ id: "location-1", activo: true, esInicial: false, sucursalId: user.sucursalId }) };
  tx.existenciaInventario = { aggregate: async () => ({ _sum: { stockActual: decimal(10) } }), upsert: async () => ({ id: "stock-1", stockActual: decimal(10) }), updateMany: async () => ({ count: 0 }) };
  tx.traspasoInventario = { aggregate: async () => ({ _sum: { cantidad: decimal(0) } }) };
  tx.productoInventario = { findUniqueOrThrow: async () => ({ id: "product-1", activo: true, stockActual: decimal(10), costoPromedio: decimal(10) }) };
  const response = await execution.POST(request({ accion: "REGISTRAR_MATERIAL", data: {
    descripcion: "Tubo", ubicacionId: "location-1", cantidad: 2, costoUnitario: 10, esDeInventario: true, productoId: "product-1",
  } }), context);
  assert.equal(response.status, 409); assert.equal(writes.length, 0);
});
test("unsafe photo schemes cannot become clickable evidence", async () => {
  work.estado = "EN_PROCESO";
  const response = await execution.POST(request({ accion: "FINALIZAR_TECNICO", data: {
    fotosTermino: ["javascript:alert(1)", "https://example.com/photo.jpg"], observacionesTermino: "Terminado y probado",
  } }), context);
  assert.equal(response.status, 400); assert.equal(writes.length, 0);
});
test("public warranty verification does not query private customer or user fields", async () => {
  let query;
  db.certificadoGarantia = { findFirst: async args => {
    query = args;
    return { codigoCertificado: "GAR-1", mesesCobertura: 2, fechaInicio: new Date(), fechaFin: new Date(Date.now() + 86400000), activo: true, trabajo: { subtipoNombre: "Servicio" } };
  } };
  const route = require("../src/app/api/garantias/[codigo]/route.ts");
  const response = await route.GET(new NextRequest("http://localhost/api/garantias/GAR-1"), { params: Promise.resolve({ codigo: "GAR-1" }) });
  assert.equal(response.status, 200);
  assert.deepEqual(query.select.trabajo, { select: { subtipoNombre: true } });
  assert.equal(query.include, undefined);
});


test("login reports Prisma initialization codes without leaking connection details", async () => {
  const login = require("../src/app/api/auth/login/route.ts");
  db.usuario.findUnique = async () => { throw Object.assign(new Error("private-database-connection-details"), { errorCode: "P1012" }); };
  const response = await login.POST(request({ email: "test@example.invalid", password: "test-only" }, { auth: false }));
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.equal(data.code, "P1012"); assert.equal(data.stage, "ACCOUNT_LOOKUP");
  assert.equal(JSON.stringify(data).includes("private-database"), false);
});
test("nonexistent login account returns invalid credentials without audit writes", async () => {
  const login = require("../src/app/api/auth/login/route.ts");
  db.usuario.findUnique = async () => null;
  const response = await login.POST(request({ email: "test@example.invalid", password: "test-only" }, { auth: false }));
  assert.equal(response.status, 401); assert.equal(writes.length, 0);
});
test("invalid login input is rejected before consulting storage", async () => {
  const login = require("../src/app/api/auth/login/route.ts");
  db.usuario.findUnique = async () => { throw new Error("must not be queried"); };
  assert.equal((await login.POST(request({ email: {}, password: [] }, { auth: false }))).status, 400);
});


test("database URL resolution supports production aliases and skips unrelated storage", () => {
  const { resolveDatabaseUrl } = require("../src/lib/database-url.ts");
  assert.equal(resolveDatabaseUrl({ STORAGE_URL: "redis://storage.invalid", POSTGRES_URL_NON_POOLING: "postgresql://database.invalid/app" }), "postgresql://database.invalid/app");
  assert.equal(resolveDatabaseUrl({ VERCEL: "1", DATABASE_URL: "postgresql://localhost/app", NEON_DATABASE_URL: "postgresql://database.invalid/app" }), "postgresql://database.invalid/app");
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: "postgresql://localhost/app" }), "postgresql://localhost/app");
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: "https://storage.invalid" }), undefined);
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: "prisma+postgres://database.invalid/app" }), "prisma+postgres://database.invalid/app");
});
test("Prisma initialization failures without codes identify missing configuration safely", () => {
  const { loginFailure } = require("../src/lib/login-failure.ts");
  const result = loginFailure(new Error("Environment variable not found: DATABASE_URL."), "ACCOUNT_LOOKUP");
  assert.equal(result.code, "DATABASE_URL_MISSING");
  assert.equal(loginFailure(new Error("the URL must start with the protocol postgresql://"), "ACCOUNT_LOOKUP").code, "DATABASE_URL_INVALID");
});


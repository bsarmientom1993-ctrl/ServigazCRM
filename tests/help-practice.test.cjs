const { test } = require("node:test");
const assert = require("node:assert/strict");
const { examples, createExample, advancePractice, nextPracticeAction, restorePractice } = require("../src/lib/practice.ts");
const { guideSteps, guideStorageKey, hasSeenGuide } = require("../src/lib/help-guide.ts");
const { assertStart, assertClose } = require("../src/lib/workflow-policy.ts");

test("ten examples cover distinct processes and consistent starting stages", () => {
  assert.equal(examples.length, 10); assert.equal(new Set(examples.map(item => item.id)).size, 10);
  assert.equal(new Set(examples.map(item => item.service)).size, 10);
  assert.deepEqual(examples.map(item => createExample(item.id).state), ["BORRADOR", "COTIZADO", "EN_PROCESO", "EVALUADO", "EVALUACION_PENDIENTE", "APROBADO", "ANTICIPO_RECIBIDO", "VALIDADO", "TERMINADO_TECNICO", "FINALIZADO_FINANCIERO"]);
  for (const example of examples) { const job = createExample(example.id); assert.ok(job.paid <= job.total); assert.ok(job.minimum <= job.total); assert.match(job.code, /^EJEMPLO-/); assert.match(job.customer, /ficticio/); }
});
test("every example reaches a valid close while respecting actual start and close requirements", () => {
  for (const example of examples) {
    let job = createExample(example.id), count = 0;
    while (nextPracticeAction(job)) {
      const { event } = nextPracticeAction(job);
      if (event === "INICIAR") assert.doesNotThrow(() => assertStart(job.state, !!job.technician, job.accepted, job.minimum, job.paid));
      if (event === "CERRAR") assert.doesNotThrow(() => assertClose(job.state, job.total, job.paid));
      job = advancePractice(job, event);
      assert.ok(++count <= 20);
    }
    assert.equal(job.state, "FINALIZADO_FINANCIERO"); assert.equal(job.paid, job.total); assert.equal(job.quality, true); assert.equal(job.closed, true);
  }
});

test("project corrections have a separate history and closure requires recorded delivery", () => {
  let job = createExample('gas-proyecto');
  assert.equal(job.state, 'VALIDADO'); assert.equal(job.paid,job.total);
  assert.throws(()=>advancePractice(job,'CERRAR'),/proyecto.*entregado/);
  assert.throws(()=>advancePractice(job,'APROBAR_PROYECTO'));
  const originalHistory=[...job.projectHistory];
  for(const event of ['CORREGIR_PROYECTO','REVISAR_PROYECTO','PRESENTAR_PROYECTO'])job=advancePractice(job,event);
  const before=job;
  job=advancePractice(job,'SEGUIMIENTO_PROYECTO');
  assert.equal(job.projectStage,'PRESENTADO');assert.equal(job.state,'VALIDADO');
  assert.equal(before.projectHistory.length,originalHistory.length+3);
  assert.throws(()=>advancePractice(job,'SEGUIMIENTO_PROYECTO'));
  assert.throws(()=>advancePractice(job,'CERRAR'));
  job=advancePractice(job,'APROBAR_PROYECTO');assert.throws(()=>advancePractice(job,'CERRAR'));
  job=advancePractice(job,'ENTREGAR_PROYECTO');job=advancePractice(job,'CERRAR');assert.equal(job.closed,true);
  assert.equal(createExample('gas-proyecto').projectStage,'OBSERVADO');
});

test("equipment-only sale teaches delivery without installation and minor gas needs no project",()=>{
  let job=createExample('equipos');
  job=advancePractice(job,'ANTICIPO');
  assert.match(nextPracticeAction(job).label,/entrega/i);
  job=advancePractice(job,'INICIAR');assert.match(nextPracticeAction(job).label,/equipo/i);
  assert.equal(job.projectStage,null);assert.equal(createExample('calidad').projectStage,null);
  const closed=createExample('cerrado');assert.equal(closed.closed,true);assert.equal(closed.projectStage,'ENTREGADO');assert.equal(nextPracticeAction(closed),null);
});
test("training cannot skip acceptance, technical completion or quality", () => {
  const gas = createExample("gas");
  for (const event of ["ACEPTAR", "ANTICIPO", "INICIAR", "VALIDAR", "CERRAR"]) assert.throws(() => advancePractice(gas, event));
  let direct = advancePractice(createExample("directo"), "COTIZAR");
  direct = advancePractice(direct, "ACEPTAR"); direct = advancePractice(direct, "ANTICIPO"); direct = advancePractice(direct, "INICIAR");
  assert.equal(direct.paid, direct.total); assert.throws(() => advancePractice(direct, "CERRAR"));
  direct = advancePractice(direct, "FINALIZAR"); assert.throws(() => advancePractice(direct, "CERRAR"));
});
test("duplicate material and payment actions never change training amounts twice", () => {
  let job = createExample("calefaccion");
  assert.throws(() => advancePractice(job, "FINALIZAR"));
  job = advancePractice(job, "MATERIALES"); assert.throws(() => advancePractice(job, "MATERIALES"));
  job = advancePractice(job, "FINALIZAR"); job = advancePractice(job, "VALIDAR");
  assert.throws(() => advancePractice(job, "CERRAR")); job = advancePractice(job, "SALDO");
  assert.throws(() => advancePractice(job, "SALDO")); assert.equal(job.paid, job.total);
});
test("practice actions do not mutate seeds or another example", () => {
  const snapshot = JSON.stringify(examples), original = createExample("gas");
  const advanced = advancePractice(original, "AGENDAR");
  assert.equal(original.state, "BORRADOR"); assert.equal(advanced.state, "EVALUACION_PENDIENTE");
  assert.equal(createExample("gas").state, "BORRADOR"); assert.equal(JSON.stringify(examples), snapshot);
});
test("saved practice history is replayed against rules and corrupted examples reset independently", () => {
  const restored = restorePractice(JSON.stringify({ gas: ["AGENDAR", "EVALUAR"], plomeria: ["CERRAR"], calefaccion: ["MATERIALES"], unknown: ["AGENDAR"] }));
  assert.deepEqual(restored, { gas: ["AGENDAR", "EVALUAR"], calefaccion: ["MATERIALES"] });
  assert.equal(restored.gas.reduce(advancePractice, createExample("gas")).state, "EVALUADO");
  for (const raw of ["broken", "null", "[]", '{"gas":[{"state":"FINALIZADO_FINANCIERO"}]}']) assert.deepEqual(restorePractice(raw), {});
});
test("welcome guide is scoped per user, can be skipped and distinguishes technical responsibilities", () => {
  assert.notEqual(guideStorageKey("user-a"), guideStorageKey("user-b"));
  assert.equal(hasSeenGuide(null), false); assert.equal(hasSeenGuide("unexpected"), false);
  assert.equal(hasSeenGuide("dismissed"), true); assert.equal(hasSeenGuide("completed"), true);
  const tech = guideSteps("TECNICO_FIJO"), manager = guideSteps("ENCARGADO"), admin = guideSteps("ADMIN");
  assert.equal(tech.length, 7); assert.equal(manager.length, 7); assert.equal(admin.length, 7);
  assert.match(tech[1].description, /asignadas/); assert.match(manager[1].description, /Nuevo trabajo/);
  assert.match(tech[4].description, /encargado/); assert.match(manager[4].points.join(" "), /saldo cero/);
});

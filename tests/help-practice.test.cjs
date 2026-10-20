const { test } = require("node:test");
const assert = require("node:assert/strict");
const { examples, createExample, advancePractice, nextPracticeAction, restorePractice } = require("../src/lib/practice.ts");
const { guideSteps, guideStorageKey, hasSeenGuide } = require("../src/lib/help-guide.ts");
const { assertStart, assertClose } = require("../src/lib/workflow-policy.ts");

test("four examples cover distinct services and consistent starting stages", () => {
  assert.equal(examples.length, 4); assert.equal(new Set(examples.map(item => item.id)).size, 4);
  assert.deepEqual(examples.map(item => createExample(item.id).state), ["BORRADOR", "COTIZADO", "EN_PROCESO", "EVALUADO"]);
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
      assert.ok(++count <= 12);
    }
    assert.equal(job.state, "FINALIZADO_FINANCIERO"); assert.equal(job.paid, job.total); assert.equal(job.quality, true); assert.equal(job.closed, true);
  }
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
  assert.equal(tech.length, 6); assert.equal(manager.length, 6); assert.equal(admin.length, 6);
  assert.match(tech[1].description, /asignadas/); assert.match(manager[1].description, /Nuevo trabajo/);
  assert.match(tech[4].description, /encargado/); assert.match(manager[4].points.join(" "), /saldo cero/);
});

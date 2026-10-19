const { test } = require("node:test");
const assert = require("node:assert/strict");
const { customerError, restoreWizardDraft, selectedServices } = require("../src/lib/work-wizard.ts");
const { slotConflicts, withinWorkingHours, localParts } = require("../src/lib/scheduling.ts");
const { randomUUID } = require("node:crypto");
const catalog = [{ id: "gas", codigo: "GAS", requiereVisita: true, subtipos: [{ id: "s1", codigo: "GAS_NUEVO", nombre: "Gas nuevo" }] }, { id: "otro", codigo: "OTROS", requiereVisita: false, subtipos: [{ id: "s2", codigo: "OTR.1", nombre: "Revisión" }] }];
const customer = { nombreCompleto: "Cliente Prueba", telefono: "76543210", direccion: "Calle 123", email: "" };
function draft(patch = {}) { return JSON.stringify({ version: 2, step: 3, customerId: null, customer, categories: ["GAS"], subtypes: { GAS: "GAS_NUEVO" }, notes: "", schedule: false, technicianId: "", date: "", requestKey: randomUUID(), ...patch }); }
test("wizard validates new client details before allowing any later step", () => {
  assert.equal(customerError(customer), "");
  for (const patch of [{ nombreCompleto: "" }, { telefono: "abcabcabc" }, { email: "incorrecto" }, { direccion: "" }]) assert.ok(customerError({ ...customer, ...patch }));
  assert.equal(customerError({ ...customer, telefono: "" }, { id: "existing" }), "");
});
test("invalid or outdated drafts cannot restore an unreachable wizard step", () => {
  assert.equal(restoreWizardDraft("broken", [], catalog, []), null);
  assert.equal(restoreWizardDraft(draft({ step: 8 }), [], catalog, []), null);
  assert.equal(restoreWizardDraft(draft({ customer: { ...customer, telefono: "" } }), [], catalog, []).step, 1);
  const stale = restoreWizardDraft(draft({ subtypes: { GAS: "deleted" } }), [], catalog, []);
  assert.equal(stale.step, 2); assert.deepEqual(stale.categories, []);
});
test("restored clients and technicians are resolved against current authorized data", () => {
  const client = { id: "known", nombreCompleto: "Actualizado", telefonos: ["12345678"], direccion: "Actual", email: null };
  const restored = restoreWizardDraft(draft({ customerId: "known", technicianId: "inactive" }), [client], catalog, []);
  assert.equal(restored.customer.nombreCompleto, "Actualizado"); assert.equal(restored.technicianId, "");
  assert.equal(restoreWizardDraft(draft({ customerId: "another-branch" }), [], catalog, []).customerId, null);
});
test("mixed categories retain the selected work types including underscore codes", () => {
  const selected = selectedServices(catalog, ["GAS", "OTROS"], { GAS: "GAS_NUEVO", OTROS: "OTR.1" });
  assert.deepEqual(selected.map(s => s.subtype.codigo), ["GAS_NUEVO", "OTR.1"]);
  assert.equal(selected.every(s => !s.category.requiereVisita), false);
});
const config = { duracionMinutos: 60, margenMinutos: 30, zonaHoraria: "America/La_Paz" };
test("availability blocks overlapping visits and travel, allowing an exact adjacent slot", () => {
  const visits = [{ fechaProgramada: new Date("2030-06-03T13:00:00Z"), condicionesJson: { agenda: config } }];
  assert.equal(slotConflicts(new Date("2030-06-03T14:00:00Z"), config, visits), true);
  assert.equal(slotConflicts(new Date("2030-06-03T14:30:00Z"), config, visits), false);
  assert.equal(slotConflicts(new Date("2030-06-03T12:30:00Z"), config, visits), true);
});
test("local working hours account for timezone, duration and travel", () => {
  const hours = { inicio: "08:30", fin: "18:00" };
  assert.equal(localParts(new Date("2030-06-03T13:00:00Z"), config.zonaHoraria).minutes, 540);
  assert.equal(withinWorkingHours(new Date("2030-06-03T13:00:00Z"), config, hours), true);
  assert.equal(withinWorkingHours(new Date("2030-06-03T12:00:00Z"), config, hours), false);
  assert.equal(withinWorkingHours(new Date("2030-06-03T21:00:00Z"), config, hours), false);
});

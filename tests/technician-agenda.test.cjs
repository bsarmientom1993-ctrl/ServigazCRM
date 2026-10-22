const { test } = require("node:test"); const assert = require("node:assert/strict");
const { activeAssignedVisit, agendaDay, agendaTiming, shiftAgendaDay } = require("../src/lib/technician-agenda.ts");
test("agenda date and navigation consistently use Bolivia dates at UTC day boundaries", () => {
  assert.equal(agendaDay(new Date("2030-06-04T03:59:00Z")), "2030-06-03");
  assert.equal(agendaDay(new Date("2030-06-04T04:00:00Z")), "2030-06-04");
  assert.equal(shiftAgendaDay("2030-06-03", 7), "2030-06-10");
  assert.equal(shiftAgendaDay("2030-01-01", -1), "2029-12-31");
});
test("visit selection respects requested visit, assignment and completion instead of newest creation", () => {
  const visits = [{ id: "done", tecnicoId: "a", completada: true, fechaProgramada: "2030-06-03T12:00:00Z" }, { id: "later", tecnicoId: "a", completada: false, fechaProgramada: "2030-06-05T12:00:00Z" }, { id: "earlier", tecnicoId: "a", completada: false, fechaProgramada: "2030-06-04T12:00:00Z" }, { id: "other", tecnicoId: "b", completada: false, fechaProgramada: "2030-06-03T12:00:00Z" }];
  assert.equal(activeAssignedVisit(visits, "a").id, "earlier");
  assert.equal(activeAssignedVisit(visits, "a", "later").id, "later");
  for (const id of ["done", "other", "invalid"]) assert.equal(activeAssignedVisit(visits, "a", id), undefined);
  assert.equal(visits[0].id, "done");
});
test("legacy or corrupted scheduling metadata gets bounded duration and travel defaults", () => {
  assert.deepEqual(agendaTiming(null), { duracion: 60, traslado: 30 });
  assert.deepEqual(agendaTiming({ agenda: { duracionMinutos: -5, margenMinutos: 9999 } }), { duracion: 60, traslado: 30 });
  assert.deepEqual(agendaTiming({ agenda: { duracionMinutos: 90, margenMinutos: 15 } }), { duracion: 90, traslado: 15 });
});

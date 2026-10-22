const { test } = require("node:test");
const assert = require("node:assert/strict");
const { contactPhones, clientMapUrl, clientVCard } = require("../src/lib/client-contact.ts");

test("contact actions normalize Bolivia and international phones without inventing missing numbers", () => {
  const phones = contactPhones(["7000 1234", "+591 7000 1234", "+56 (9) 1234-5678", "0056 9 1234 5678", "1234567", "sin teléfono", "javascript:12345678"]);
  assert.equal(phones.length, 3);
  assert.equal(phones[0].whatsapp, "59170001234");
  assert.equal(phones[0].tel, "tel:+59170001234");
  assert.equal(phones[1].whatsapp, "56912345678");
  assert.equal(phones[2].whatsapp, null);
  assert.deepEqual(contactPhones(null), []);
  assert.equal(contactPhones("+59170001234")[0].whatsapp, "59170001234");
});

test("maps uses a saved location or an encoded address, rejects executable URLs", () => {
  assert.equal(clientMapUrl({ ubicacionMapsUrl: "https://maps.app.goo.gl/example" }), "https://maps.app.goo.gl/example");
  assert.equal(clientMapUrl({ ubicacionMapsUrl: "javascript:alert(1)", direccion: "Calle A & B #4" }), "https://www.google.com/maps/dir/?api=1&destination=Calle%20A%20%26%20B%20%234");
  assert.equal(clientMapUrl({ direccion: " " }), null);
});

test("downloaded contact preserves names and phones and escapes user text as vCard data", () => {
  const card = clientVCard({ nombreCompleto: "José; Pérez, Ana\nTEL:999", telefonos: ["70001234", "+56912345678"], direccion: "Calle 1; casa 2\nLa Paz" });
  assert.ok(card.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n"));
  assert.ok(card.includes("FN:José\\; Pérez\\, Ana\\nTEL:999\r\n"));
  assert.ok(card.includes("TEL;TYPE=VOICE:+59170001234\r\n"));
  assert.ok(card.includes("TEL;TYPE=VOICE:+56912345678\r\n"));
  assert.ok(!card.includes("\r\nTEL:999"));
  assert.ok(card.endsWith("END:VCARD\r\n"));
});

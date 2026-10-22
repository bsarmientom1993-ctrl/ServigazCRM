export type ContactClient = {
  nombreCompleto: string;
  telefonos?: string[] | string | null;
  direccion?: string | null;
  ubicacionMapsUrl?: string | null;
};

export function contactPhones(value: ContactClient["telefonos"]) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set<string>();
  return values.flatMap(raw => {
    const number = raw.trim().replace(/[\s().-]/g, "");
    if (!/^\+?\d{7,15}$/.test(number)) return [];
    const digits = number.replace(/^\+|^00/g, "");
    // Los números locales de Bolivia tienen ocho dígitos.
    const international = !number.startsWith("+") && !number.startsWith("00") && digits.length === 8 ? "591" + digits : digits;
    if (seen.has(international)) return [];
    seen.add(international);
    const whatsapp = international.length >= 10 && international.length <= 15 ? international : null;
    return [{ display: raw.trim(), tel: "tel:" + (whatsapp ? "+" + international : number), whatsapp }];
  });
}

export function clientMapUrl(client: ContactClient) {
  try {
    const url = new URL(client.ubicacionMapsUrl || "");
    if (["https:", "http:"].includes(url.protocol)) return url.href;
  } catch { /* Usar dirección si no hay un enlace válido. */ }
  return client.direccion?.trim() ? "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(client.direccion.trim()) : null;
}

const escapeVCard = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
export function clientVCard(client: ContactClient) {
  return ["BEGIN:VCARD", "VERSION:3.0", "FN:" + escapeVCard(client.nombreCompleto), "N:;" + escapeVCard(client.nombreCompleto) + ";;;", ...contactPhones(client.telefonos).map(phone => "TEL;TYPE=VOICE:" + phone.tel.slice(4)), ...(client.direccion ? ["ADR;TYPE=HOME:;;" + escapeVCard(client.direccion) + ";;;;"] : []), "END:VCARD", ""].join("\r\n");
}

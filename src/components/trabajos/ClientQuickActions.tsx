"use client";
import { ContactRound, MapPin, MessageCircle, Phone } from "lucide-react";
import { clientMapUrl, clientVCard, contactPhones, type ContactClient } from "@/lib/client-contact";

export function ClientQuickActions({ client }: { client: ContactClient }) {
  const phones = contactPhones(client.telefonos), mapUrl = clientMapUrl(client);
  const action = "theme-toggle !min-h-12 !w-full !justify-center !px-3 !py-3 text-sm";
  function saveContact() {
    const url = URL.createObjectURL(new Blob([clientVCard(client)], { type: "text/vcard;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "cliente-servigaz.vcf";
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  return <section aria-label={"Contacto de " + client.nombreCompleto} className="rounded-xl border border-line p-3 sm:p-4 space-y-3">
    <h5 className="text-sm font-semibold text-ink">Contacto del cliente</h5>
    {phones.length ? phones.map((phone, index) => <div key={phone.tel} className="space-y-2">
      <p className="text-sm text-secondary break-words">{phones.length > 1 ? `Teléfono ${index + 1}: ` : "Teléfono: "}<a className="underline underline-offset-4 inline-flex min-h-8 items-center" href={phone.tel}>{phone.display}</a></p>
      <div className="grid grid-cols-2 gap-2">
        <a className={action} href={phone.tel} aria-label={"Llamar a " + phone.display}><Phone size={19} className="shrink-0" />Llamar</a>
        {phone.whatsapp ? <a className={action + " !text-emerald-700 dark:!text-emerald-300"} href={"https://wa.me/" + phone.whatsapp} target="_blank" rel="noopener noreferrer" aria-label={"WhatsApp a " + phone.display}><MessageCircle size={19} className="shrink-0" />WhatsApp</a> : <p className="text-xs text-muted self-center">Agrega el código de país para usar WhatsApp.</p>}
      </div>
    </div>) : <p className="text-sm text-muted">Sin teléfono registrado. Solicítalo al encargado.</p>}
    <div className="grid grid-cols-2 gap-2">
      {mapUrl && <a className={action} href={mapUrl} target="_blank" rel="noopener noreferrer"><MapPin size={19} className="shrink-0" />Maps</a>}
      <button type="button" className={action} onClick={saveContact}><ContactRound size={19} className="shrink-0" />Guardar contacto</button>
    </div>
    {!mapUrl && <p className="text-xs text-muted">Sin dirección ni ubicación registrada. Consulta al encargado antes de salir.</p>}
    <p className="text-xs text-muted">Guardar contacto descarga una tarjeta para abrirla en Contactos. WhatsApp se abre sin enviar mensajes automáticamente.</p>
  </section>;
}

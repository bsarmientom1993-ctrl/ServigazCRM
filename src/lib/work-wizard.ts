import { z } from "zod";

export type Customer = { id: string; nombreCompleto: string; telefonos: string[]; direccion: string | null; email: string | null };
export type Category = { id: string; codigo: string; nombre: string; descripcion?: string | null; requiereVisita: boolean; subtipos: { id: string; codigo: string; nombre: string }[] };
export type CustomerForm = { nombreCompleto: string; telefono: string; direccion: string; email: string };
export const emptyCustomer: CustomerForm = { nombreCompleto: "", telefono: "", direccion: "", email: "" };
export const newCustomerSchema = z.object({
  nombreCompleto: z.string().trim().min(2, "Escribe el nombre del cliente (al menos 2 caracteres).").max(300),
  telefono: z.string().trim().min(7, "Escribe un teléfono válido (al menos 7 dígitos).").max(30).refine(v => v.replace(/\D/g, "").length >= 7, "Escribe un teléfono válido (al menos 7 dígitos)."),
  direccion: z.string().trim().min(3, "Escribe la dirección del cliente (al menos 3 caracteres).").max(1000),
  email: z.string().trim().email("Revisa el correo electrónico.").nullish(),
});
export function customerError(form: CustomerForm, selected: Customer | undefined) {
  if (selected) return "";
  const result = newCustomerSchema.safeParse({ ...form, email: form.email.trim() || null });
  return result.success ? "" : result.error.issues[0].message;
}
export function selectedServices(catalog: Category[], categories: string[], subtypes: Record<string, string>) {
  return categories.flatMap(code => {
    const category = catalog.find(c => c.codigo === code);
    const subtype = category?.subtipos.find(s => s.codigo === subtypes[code]);
    return category && subtype ? [{ category, subtype }] : [];
  });
}
const draftSchema = z.object({
  version: z.literal(2), step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  customerId: z.string().nullable(), customer: z.object({ nombreCompleto: z.string(), telefono: z.string(), direccion: z.string(), email: z.string() }),
  categories: z.array(z.string()), subtypes: z.record(z.string()), notes: z.string(),
  includesGasProject: z.boolean().default(false),
  details: z.string().default(""),
  preference: z.object({ fecha: z.string(), desde: z.string(), hasta: z.string() }).default({ fecha: "", desde: "", hasta: "" }),
  duration: z.number().int().min(15).max(480).default(60), margin: z.number().int().min(0).max(120).default(30),
  schedule: z.boolean(), technicianId: z.string(), date: z.string(), requestKey: z.string().uuid(),
});
export function restoreWizardDraft(raw: string, customers: Customer[], catalog: Category[], technicians: { id: string }[]) {
  try {
    const result = draftSchema.safeParse(JSON.parse(raw));
    if (!result.success) return null;
    const draft = result.data;
    const selected = customers.find(c => c.id === draft.customerId);
    draft.customerId = selected?.id || null;
    if (selected) draft.customer = { nombreCompleto: selected.nombreCompleto, telefono: selected.telefonos[0] || "", direccion: selected.direccion || "", email: selected.email || "" };
    const valid = selectedServices(catalog, draft.categories, draft.subtypes);
    draft.categories = valid.map(s => s.category.codigo);
    draft.subtypes = Object.fromEntries(valid.map(s => [s.category.codigo, s.subtype.codigo]));
    if (!technicians.some(t => t.id === draft.technicianId)) draft.technicianId = "";
    if (customerError(draft.customer, selected)) draft.step = 1;
    else if (!valid.length) draft.step = Math.min(draft.step, 2) as 1 | 2;
    return draft;
  } catch { return null; }
}
export function localDateInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

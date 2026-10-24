import { z } from 'zod';
import { contactPhones } from './client-contact';
export const storeConfigSchema = z.object({
  activa: z.boolean(), titulo: z.string().trim().min(2).max(100),
  descripcion: z.string().trim().max(800), whatsapp: z.string().trim().max(30).refine(value => !value || Boolean(contactPhones(value)[0]?.whatsapp), 'Escribe un número de WhatsApp válido con código de país.'),
  entrega: z.string().trim().max(800),
}).refine(value => !value.activa || Boolean(value.whatsapp), 'Configura WhatsApp antes de abrir la tienda.');
export const defaultStoreConfig = { activa: false, titulo: 'Equipos y materiales para tu próximo proyecto', descripcion: 'Encuentra equipos y materiales de gas, calefacción y plomería. Te ayudamos a elegir lo que necesitas.', whatsapp: '', entrega: 'Coordinamos disponibilidad, forma de pago y retiro o entrega por WhatsApp. La instalación se cotiza por separado.' };
export function storeConfig(value: unknown) { const result = storeConfigSchema.safeParse(value); return result.success ? result.data : {...defaultStoreConfig}; }
export type StoreProduct = { id: string; nombre: string; codigoSku: string; categoria: string; unidadMedida: string; precio: number; descripcion: string; destacado: boolean; imagen: string | null };
export type CartLine = { productoId: string; cantidad: number };
export function storeCart(products: StoreProduct[], cart: CartLine[]) {
  return cart.flatMap(line => {
    const producto = products.find(product => product.id === line.productoId);
    return producto && Number.isInteger(line.cantidad) && line.cantidad > 0 && line.cantidad <= 99 ? [{ producto, cantidad: line.cantidad, subtotal: Math.round(producto.precio * 100) * line.cantidad }] : [];
  });
}
export const storeMoney = (value: number) => value.toLocaleString('es-BO',{minimumFractionDigits:2,maximumFractionDigits:2});
export function storeWhatsApp(whatsapp: string, products: StoreProduct[], cart: CartLine[]) {
  const phone = contactPhones(whatsapp)[0]?.whatsapp, lines = storeCart(products,cart);
  if (!phone || !lines.length) return null;
  const text = ['Hola Servigaz, quiero consultar este pedido:', ...lines.map(line => `• ${line.cantidad} × ${line.producto.nombre} [${line.producto.codigoSku}] (${line.producto.unidadMedida}): Bs. ${storeMoney(line.subtotal/100)}`), `Total referencial: Bs. ${storeMoney(lines.reduce((sum,line)=>sum+line.subtotal,0)/100)}`, 'Por favor confirmen disponibilidad, precio final, pago y opciones de entrega.'].join('\n');
  return 'https://wa.me/'+phone+'?text='+encodeURIComponent(text);
}

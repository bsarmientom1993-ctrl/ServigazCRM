import { z } from 'zod';
export const sealWarning = 'SELLO ROTO O MANIPULADO: GARANTÍA DE ESTA COBERTURA ANULADA';
const text = (max:number) => z.string().trim().min(1).max(max).refine(s => !/[\u0000-\u001f\u007f]/.test(s), 'Revisa el texto.');
export const warrantyLabelSchema = z.object({
  operacion: z.enum(['REVISION','VENTA']), equipo: text(45), marca: text(30), modelo: text(35),
  serie: z.string().trim().max(45).default(''), cobertura: text(120),
}).strict();
export function sealStatus(label:{anuladaAt:Date|string|null;fechaFin:Date|string}, now=new Date()) {
  return label.anuladaAt ? 'ANULADA' : new Date(label.fechaFin) < now ? 'VENCIDA' : 'VIGENTE';
}

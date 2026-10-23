import { z } from 'zod';

// Local stationery assets or inline raster images only: no tracking URLs or executable SVG/HTML.
const image = z.string().max(700000).refine(value => value === '' || ['/quote-header.png', '/quote-footer.png'].includes(value) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value), 'Usa una imagen PNG, JPG o WebP de hasta 500 KB.');
export const quoteTemplateSchema = z.object({
  empresa: z.string().trim().min(1).max(150), titulo: z.string().trim().min(1).max(80),
  tituloAlcance: z.string().trim().min(1).max(120), tituloPresupuesto: z.string().trim().min(1).max(120),
  introduccion: z.string().trim().max(600), despedida: z.string().trim().max(100), pieTexto: z.string().trim().max(1000),
  colorTexto: z.string().regex(/^#[0-9a-fA-F]{6}$/), colorSecciones: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  papel: z.enum(['letter', 'a4']), fuente: z.number().int().min(11).max(15),
  encabezadoImagen: image, pieImagen: image,
});
export type QuoteTemplate = z.infer<typeof quoteTemplateSchema>;
export const defaultQuoteTemplate: QuoteTemplate = {
  empresa: 'SERVIGAZ · Equipos e Instalaciones', titulo: 'COTIZACIÓN',
  tituloAlcance: 'DETALLE DEL PROYECTO Y ALCANCE', tituloPresupuesto: 'PRESUPUESTO Y DESGLOSE DE COSTOS',
  introduccion: 'La propuesta contempla los siguientes trabajos y suministros:', despedida: 'Atentamente,',
  pieTexto: 'Sucursal La Paz: Calle Picada Chaco N°894.\nSucursal El Alto: Z. Villa Bolívar C, Av. América N°3591.\nAtención al cliente: 70595595 - 75801284.',
  colorTexto: '#1d3e67', colorSecciones: '#fce7de', papel: 'letter', fuente: 13,
  encabezadoImagen: '/quote-header.png', pieImagen: '/quote-footer.png',
};
export function resolveQuoteTemplate(value: unknown): QuoteTemplate {
  const parsed = quoteTemplateSchema.safeParse(value);
  return parsed.success ? parsed.data : { ...defaultQuoteTemplate };
}

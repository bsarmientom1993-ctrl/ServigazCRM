import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { requireSession } from '@/lib/auth';
import { apiError, ApiError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { quoteTemplateSchema, resolveQuoteTemplate } from '@/lib/quote-template';

export async function GET(req: NextRequest) {
  try {
    await requireSession(req, ['ADMIN']);
    const current = await prisma.formatoCotizacion.findUnique({ where: { id: 'general' } });
    return NextResponse.json({ formato: resolveQuoteTemplate(current?.formato), actualizado: current?.updatedAt || null });
  } catch (error) { return apiError(error); }
}
export async function PUT(req: NextRequest) {
  try {
    const actor = await requireSession(req, ['ADMIN']);
    if (Number(req.headers.get('content-length')) > 1500000) throw new ApiError(413, 'Las imágenes son demasiado grandes.');
    const formato = quoteTemplateSchema.parse(await req.json());
    for (const value of [formato.encabezadoImagen, formato.pieImagen]) {
      if (!value.startsWith('data:')) continue;
      const bytes = Buffer.from(value.split(',')[1], 'base64');
      if (bytes.length > 512000) throw new ApiError(400, 'Cada imagen debe pesar hasta 500 KB.');
      try {
        const info = await sharp(bytes, { limitInputPixels: 16000000 }).metadata();
        if (!['png', 'jpeg', 'webp'].includes(info.format || '') || (info.pages || 1) > 1) throw new Error('format');
      } catch { throw new ApiError(400, 'La imagen debe ser un PNG, JPG o WebP válido y no animado.'); }
    }
    await prisma.$transaction(async tx => {
      const previous = await tx.formatoCotizacion.findUnique({ where: { id: 'general' } });
      await tx.formatoCotizacion.upsert({ where: { id: 'general' }, create: { id: 'general', formato, modificadoPor: actor.id }, update: { formato, modificadoPor: actor.id } });
      await tx.auditoriaLog.create({ data: { usuarioId: actor.id, modulo: 'FORMATO_COTIZACION', accion: 'UPDATE', entidadTipo: 'FormatoCotizacion', entidadId: 'general', valoresNuevos: { titulo: formato.titulo, empresa: formato.empresa, papel: formato.papel, configuradoAnteriormente: Boolean(previous) } } });
    });
    return NextResponse.json({ formato, success: true });
  } catch (error) { return apiError(error); }
}

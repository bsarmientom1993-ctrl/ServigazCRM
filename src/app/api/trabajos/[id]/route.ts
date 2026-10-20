import { requireSession, assertWorkAccess } from "@/lib/auth";
import { objectRecord } from "@/lib/gas-data";
import { apiError } from "@/lib/api";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSession(req);
    const { id } = await params;
    const trabajo = await prisma.trabajo.findUnique({
      where: { id },
      include: {
        cliente: true,
        encargado: { select: { id: true, nombre: true, email: true, telefono: true } },
        tecnico: { select: { id: true, nombre: true, email: true, telefono: true } },
        visitas: {
          orderBy: { createdAt: "desc" },
          include: { tecnico: { select: { id: true, nombre: true } } },
        },
        cotizaciones: {
          orderBy: { numeroVersion: "desc" },
        },
        pagos: {
          orderBy: { fechaPago: "desc" },
        },
        materiales: {
          orderBy: { createdAt: "desc" },
        },
        egreso: true,
        garantia: true,
      },
    });

    if (!trabajo) {
      return NextResponse.json({ error: "Trabajo no encontrado" }, { status: 404 });
    }

    assertWorkAccess(user, trabajo);
    const evidenciasTermino = await prisma.auditoriaLog.findFirst({
      where: { entidadId: id, entidadTipo: "Trabajo", modulo: "EJECUCION", valoresNuevos: { path: ["accion"], equals: "FINALIZAR_TECNICO" } },
      orderBy: { timestamp: "desc" }, select: { valoresNuevos: true, timestamp: true },
    });
    const historialProyectoGas = await prisma.auditoriaLog.findMany({ where: { entidadId: id, entidadTipo: "Trabajo", modulo: { in: ["PROYECTO_GAS", "SUPERVISION_GAS"] } }, orderBy: { timestamp: "desc" }, take: 30, select: { id: true, timestamp: true, modulo: true, valoresNuevos: true, usuario: { select: { nombre: true } } } });
    const legacyIds = trabajo.cotizaciones.filter(quote => !objectRecord(objectRecord(quote.datosFormularioJson).carta).cotizadoPorNombre).map(quote => quote.id);
    const issuers = legacyIds.length ? await prisma.auditoriaLog.findMany({
      where: { entidadTipo: "Cotizacion", entidadId: { in: legacyIds }, modulo: "COTIZACIONES", accion: "CREATE" },
      orderBy: { timestamp: "asc" }, select: { entidadId: true, usuario: { select: { nombre: true } } },
    }) : [];
    const names = new Map<string, string>();
    for (const entry of issuers) if (entry.entidadId && entry.usuario?.nombre && !names.has(entry.entidadId)) names.set(entry.entidadId, entry.usuario.nombre);
    const cotizaciones = trabajo.cotizaciones.map(quote => ({ ...quote, emitidoPorNombre: objectRecord(objectRecord(quote.datosFormularioJson).carta).cotizadoPorNombre || names.get(quote.id) || null }));
    return NextResponse.json({ ...trabajo, cotizaciones, evidenciasTermino, historialProyectoGas });
  } catch (error) { return apiError(error); }
}

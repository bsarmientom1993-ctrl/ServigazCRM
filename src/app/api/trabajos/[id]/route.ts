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
    const activity = await prisma.auditoriaLog.findMany({
      where: { OR: [
        { entidadTipo: "Trabajo", entidadId: id },
        { entidadTipo: "Cotizacion", entidadId: { in: trabajo.cotizaciones.map(item => item.id) } },
        { entidadTipo: "Pago", entidadId: { in: trabajo.pagos.map(item => item.id) } },
        { entidadTipo: "MaterialEjecucion", entidadId: { in: trabajo.materiales.map(item => item.id) } },
        ...(trabajo.egreso ? [{ entidadTipo: "EgresoTrabajo", entidadId: trabajo.egreso.id }] : []),
      ] },
      orderBy: { timestamp: "desc" }, take: 100,
      select: { id: true, timestamp: true, modulo: true, accion: true, valoresNuevos: true, usuarioId: true, usuario: { select: { nombre: true } } },
    });
    const labels: Record<string, string> = { AGENDAR_VISITA: "Visita coordinada", COMPLETAR_VISITA: "Evaluación técnica registrada", GUARDAR_EVALUACION: "Evaluación técnica registrada", INICIAR_EJECUCION: "Trabajo iniciado", FINALIZAR_TECNICO: "Trabajo terminado por el técnico", VALIDAR_ENCARGADO: "Calidad validada", ACTUALIZAR_PROYECTO: "Avance del proyecto registrado", INCLUIR_PROYECTO: "Alcance del proyecto actualizado", REVISAR_MEDICION: "Medición revisada" };
    const historialActividad = activity.map(event => {
      const values = objectRecord(event.valoresNuevos);
      const label = labels[values.accion] || (event.modulo === "COTIZACIONES" ? "Cotización emitida" : event.modulo === "PAGOS" ? "Pago registrado" : event.modulo === "CIERRE_FINANCIERO" ? "Cierre financiero realizado" : event.modulo === "EJECUCION" && event.accion === "CREATE" ? "Material registrado" : event.modulo === "TRABAJOS" && values.cotizacionId ? (values.estado === "RECHAZADO" ? "Cotización rechazada" : "Venta confirmada") : event.modulo === "TRABAJOS" && event.accion === "CREATE" ? "Solicitud registrada" : "Orden actualizada");
      return { id: event.id, fecha: event.timestamp, accion: label, usuarioId: event.usuarioId, nombre: typeof values.realizadoPor === "string" ? values.realizadoPor : event.usuario?.nombre || "Usuario no disponible" };
    });
    return NextResponse.json({ ...trabajo, cotizaciones, evidenciasTermino, historialProyectoGas, historialActividad });
  } catch (error) { return apiError(error); }
}

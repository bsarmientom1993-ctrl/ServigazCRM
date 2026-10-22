import { Prisma } from "@prisma/client";
import { objectRecord } from "./gas-data";

// Explicit selection: financial relations and future work fields cannot leak into this view.
export const technicalWorkSelect = {
  id: true, codigoCorrelativo: true, clienteId: true, sucursalId: true, encargadoId: true, tecnicoId: true,
  tipoFlujo: true, subtipoCodigo: true, subtipoNombre: true, estado: true, dificultadNivel: true,
  requiereInstaladorExtra: true, porcentajeAvance: true, motivoPausa: true, observaciones: true,
  fechasSla: true, fechaInicioEjecucion: true, fechaFinEjecucion: true, createdAt: true, updatedAt: true,
  cliente: { select: { nombreCompleto: true, direccion: true, telefonos: true, ubicacionMapsUrl: true } },
  tecnico: { select: { id: true, nombre: true, telefono: true } },
  encargado: { select: { id: true, nombre: true, telefono: true } },
  visitas: { orderBy: { fechaProgramada: "asc" }, select: { id: true, tecnicoId: true, fechaProgramada: true,
    fechaEjecutada: true, medidasJson: true, condicionesJson: true, ventilacionVasaOk: true, fotosUrls: true,
    dificultadSugerida: true, observaciones: true, completada: true, tecnico: { select: { id: true, nombre: true } } } },
  materiales: { select: { id: true, productoId: true, descripcion: true, cantidad: true, tipoOrigen: true, consumido: true } },
} satisfies Prisma.TrabajoSelect;

export function technicalSchedule(value: unknown) {
  const source = objectRecord(value), gas = objectRecord(source.gas);
  const project = objectRecord(gas.proyecto), review = objectRecord(gas.supervision), preference = objectRecord(source.preferenciaCliente);
  return {
    preferenciaCliente: source.preferenciaCliente ? { fecha: preference.fecha, desde: preference.desde, hasta: preference.hasta } : null,
    gas: { aplica: gas.aplica, proyecto: gas.proyecto ? {
      incluido: project.incluido, estado: project.estado, responsable: project.responsable, fechaObjetivo: project.fechaObjetivo,
      referencia: project.referencia, observaciones: project.observaciones, documentosUrls: project.documentosUrls || [], actualizado: project.actualizado,
    } : undefined, supervision: gas.supervision ? {
      estado: review.estado, visitaId: review.visitaId, supervisorNombre: review.supervisorNombre, fecha: review.fecha,
      criterio: review.criterio, metrosVisto: review.metrosVisto, metrosEmpotrado: review.metrosEmpotrado,
    } : undefined },
  };
}

import { Prisma } from "@prisma/client";
import { objectRecord } from "./gas-data";

export const projectEventTypes = ["SEGUIMIENTO", "CONTACTO_ENTIDAD", "OBSERVACION_ENTIDAD", "CORRECCION_ENVIADA", "DOCUMENTO_ADJUNTO"] as const;
export const projectEventLabels: Record<string, string> = { ASIGNAR_RESPONSABLES: "Origen comercial y responsables actualizados", SEGUIMIENTO: "Seguimiento diario", CONTACTO_ENTIDAD: "Contacto con la entidad", OBSERVACION_ENTIDAD: "Observación recibida", CORRECCION_ENVIADA: "Corrección enviada", DOCUMENTO_ADJUNTO: "Documento adjunto", ACTUALIZAR_PROYECTO: "Etapa o datos actualizados", INCLUIR_PROYECTO: "Alcance del proyecto actualizado" };
export function projectHistoryScope(id: string): Prisma.AuditoriaLogWhereInput {
  return { entidadId: id, modulo: "PROYECTO_GAS", entidadTipo: { in: ["ProyectoGas", "Trabajo"] } };
}
export function projectHistoryEvent(event: { id: string; timestamp: Date; valoresNuevos: unknown; usuario?: { nombre: string } | null }) {
  const values = objectRecord(event.valoresNuevos), project = objectRecord(objectRecord(values.gas).proyecto);
  const log = objectRecord(values.seguimiento), snapshot = objectRecord(values.proyecto);
  const source = Object.keys(snapshot).length ? snapshot : project;
  return { id: event.id, registradoEn: event.timestamp, fechaGestion: log.fechaGestion || null,
    tipo: log.tipo || values.accion || "ACTUALIZAR_PROYECTO", detalle: log.detalle || source.observaciones || "Alcance del proyecto actualizado",
    autor: values.realizadoPor || event.usuario?.nombre || "Usuario no disponible", estado: source.estado || null,
    entidad: log.entidad || source.entidad || "", referencia: log.referencia || source.referencia || "",
    proximoSeguimiento: log.proximoSeguimiento || "", documentosUrls: log.documentosUrls || source.documentosUrls || [],
  };
}

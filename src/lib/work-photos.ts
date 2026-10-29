import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "./api";
import { assertWorkAccess, type Session, workScope } from "./auth";
import { photoStages, type PhotoStage } from "./photo-data";
export { photoStages, photoStageLabels, photoLimit } from "./photo-data";
export const photoWorkSelect = { id: true, codigoCorrelativo: true, tecnicoId: true, encargadoId: true, sucursalId: true, estado: true, cliente: { select: { nombreCompleto: true } }, cotizaciones: { orderBy: { numeroVersion: "desc" }, take: 1, select: { estado: true } } } satisfies Prisma.TrabajoSelect;
type PhotoWork = Prisma.TrabajoGetPayload<{ select: typeof photoWorkSelect }>;
export function proposalAccepted(work: PhotoWork) { return work.cotizaciones[0]?.estado === "APROBADA" && !["CANCELADO", "RECHAZADO"].includes(work.estado); }
export function photoPermissions(user: Session, work: PhotoWork) {
  const assigned = work.tecnicoId === user.id;
  const branch = Boolean(user.sucursalId && user.sucursalId === work.sucursalId);
  const manager = user.rol !== "TECNICO_FIJO";
  if (manager) assertWorkAccess(user, work);
  else if (!assigned && !(branch && proposalAccepted(work))) throw new ApiError(403, "No tienes acceso al registro fotográfico de este trabajo.");
  const initial = (manager || assigned) && !proposalAccepted(work) && ["BORRADOR", "EVALUACION_PENDIENTE", "EVALUADO", "COTIZADO", "COTIZACION_VENCIDA", "EN_NEGOCIACION"].includes(work.estado);
  return { INICIAL: initial, FINAL: user.rol!=='VENTAS' && proposalAccepted(work) && (manager || assigned || branch) };
}
export function photoWorkScope(user: Session): Prisma.TrabajoWhereInput {
  if (user.rol !== "TECNICO_FIJO") return workScope(user);
  const options: Prisma.TrabajoWhereInput[] = [{ tecnicoId: user.id }];
  if (user.sucursalId) options.push({ sucursalId: user.sucursalId, estado: { notIn: ["CANCELADO", "RECHAZADO"] }, cotizaciones: { some: { estado: "APROBADA" } } });
  return { OR: options };
}
export const photoMetadataSelect = { id: true, trabajoId: true, etapa: true, descripcion: true, autorNombre: true, createdAt: true, ancho: true, alto: true } satisfies Prisma.FotoTrabajoSelect;
export function photoUrl(workId: string, photoId: string) { return "/api/trabajos/" + encodeURIComponent(workId) + "/fotos/" + encodeURIComponent(photoId); }
function privatePhoto(value: string) { try { const path = value.startsWith("/") ? value : new URL(value).pathname; return /^\/api\/trabajos\/([^/]+)\/fotos\/([a-f0-9-]{36})$/i.exec(path); } catch { return null; } }
export const evidencePhoto = z.string().max(2000).refine(value => Boolean(privatePhoto(value)) || /^https?:\/\//i.test(value) && !value.includes("unsplash.com"), "Adjunta fotografías guardadas en la carpeta del trabajo o un enlace HTTP/HTTPS válido.");
export async function assertPhotoReferences(tx: Prisma.TransactionClient, values: string[], workId: string, stage: PhotoStage) {
  const refs = values.map(privatePhoto).filter((value): value is RegExpExecArray => Boolean(value));
  if (!refs.length) return;
  if (refs.some(ref => ref[1] !== workId)) throw new ApiError(400, "La fotografía pertenece a otro trabajo.");
  const ids = [...new Set(refs.map(ref=>ref[2]))];
  if (await tx.fotoTrabajo.count({ where: { trabajoId: workId, etapa: stage, id: { in: ids } } }) !== ids.length) throw new ApiError(400, "Selecciona fotografías de la carpeta correspondiente a esta etapa.");
}

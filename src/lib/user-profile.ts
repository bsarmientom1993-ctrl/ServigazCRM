import { z } from "zod";
import { prisma } from "./prisma";
import { ApiError } from "./api";
import { Session } from "./auth";
export const profileSchema = z.object({
  nombre: z.string().trim().min(3, "Escribe tu nombre completo.").max(150).refine(value => !/[\u0000-\u001f\u007f]/.test(value), "Revisa el nombre."),
  telefono: z.string().trim().max(40).regex(/^[+\d\s().-]*$/, "Revisa el teléfono.").default(""),
}).strict();
export async function updateProfile(actor: Session, id: string, input: unknown) {
  if (actor.id !== id && actor.rol !== "ADMIN") throw new ApiError(403, "Solo el administrador puede editar otro perfil.");
  const data = profileSchema.parse(input);
  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Usuario" WHERE id = ${id} FOR UPDATE`;
    if (!rows.length) throw new ApiError(404, "Usuario no encontrado.");
    const before = await tx.usuario.findUniqueOrThrow({ where: { id }, select: { nombre: true, telefono: true } });
    const author = await tx.usuario.findUniqueOrThrow({ where: { id: actor.id }, select: { nombre: true } });
    const updated = await tx.usuario.update({ where: { id }, data: { nombre: data.nombre, telefono: data.telefono || null }, select: { id: true, nombre: true, telefono: true } });
    await tx.auditoriaLog.create({ data: { usuarioId: actor.id, modulo: "PERFILES", accion: "UPDATE", entidadTipo: "Usuario", entidadId: id, valoresAnteriores: before, valoresNuevos: { ...updated, realizadoPor: author.nombre } } });
    return updated;
  });
}

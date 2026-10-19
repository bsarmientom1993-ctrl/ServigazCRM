import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(req, ["ADMIN"]);
    const { id } = await params;
    const data = z.object({ nombre: z.string().trim().min(2).max(150).optional(), direccion: z.string().trim().max(500).optional(),
      telefono: z.string().trim().max(40).optional(), activo: z.boolean().optional(), usuarioId: z.string().min(1).optional() }).strict().parse(await req.json());
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Sucursal" WHERE id = ${id} FOR UPDATE`;
      const branch = await tx.sucursal.findUnique({ where: { id } });
      if (!branch) throw new ApiError(404, "Sucursal no encontrada.");
      if (data.usuarioId) {
        if (!branch.activo) throw new ApiError(409, "La sucursal está inactiva.");
        await tx.usuario.update({ where: { id: data.usuarioId }, data: { sucursalId: id } });
      }
      if (data.activo === false && (await tx.ubicacionInventario.count({ where: { sucursalId: id, activo: true } }) ||
        await tx.usuario.count({ where: { sucursalId: id, estado: "ACTIVO" } }))) throw new ApiError(409, "Reasigna el personal y desactiva las ubicaciones antes de desactivar la sucursal.");
      const { usuarioId, ...fields } = data;
      const updated = await tx.sucursal.update({ where: { id }, data: fields });
      await tx.auditoriaLog.create({ data: { usuarioId: user.id, modulo: "SUCURSALES", accion: "UPDATE", entidadTipo: "Sucursal", entidadId: id, valoresNuevos: data } });
      return updated;
    });
    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ApiError, apiError } from "@/lib/api";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(req, ["ADMIN"]);
    const { id } = await params;
    const data = z.object({ nombre: z.string().trim().min(2).max(150).optional(), direccion: z.string().trim().max(500).optional(), activo: z.boolean().optional() }).strict().parse(await req.json());
    const result = await prisma.$transaction(async tx => {
      const parent = await tx.ubicacionInventario.findUnique({ where: { id }, select: { sucursalId: true } });
      if (parent?.sucursalId) {
        await tx.$queryRaw`SELECT id FROM "Sucursal" WHERE id = ${parent.sucursalId} FOR SHARE`;
        if (data.activo === true && !(await tx.sucursal.findUnique({ where: { id: parent.sucursalId } }))?.activo) throw new ApiError(409, "Activa primero la sucursal.");
      }
      const found = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "UbicacionInventario" WHERE id = ${id} FOR UPDATE`;
      if (!found.length) throw new ApiError(404, "Ubicación no encontrada.");
      const old = await tx.ubicacionInventario.findUniqueOrThrow({ where: { id } });
      if (old.esInicial) throw new ApiError(409, "El inventario previo se conserva como referencia hasta distribuirlo.");
      if (data.activo === false) {
        const stocks = await tx.existenciaInventario.count({ where: { ubicacionId: id, stockActual: { gt: 0 } } });
        const pending = await tx.traspasoInventario.count({ where: { estado: "EN_TRANSITO", OR: [{ origenId: id }, { destinoId: id }] } });
        if (stocks || pending) throw new ApiError(409, "Distribuye el stock y resuelve los traspasos antes de desactivar.");
      }
      const location = await tx.ubicacionInventario.update({ where: { id }, data });
      await tx.auditoriaLog.create({ data: { usuarioId: user.id, modulo: "UBICACIONES", accion: "UPDATE", entidadTipo: "UbicacionInventario", entidadId: id,
        valoresAnteriores: { nombre: old.nombre, activo: old.activo }, valoresNuevos: data } });
      return location;
    });
    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, inventoryOperators } from "@/lib/auth";
import { ApiError, apiError } from "@/lib/api";
import { lockLocations, locationForOperation, lockProduct, stockRow } from "@/lib/inventory";
import { Prisma } from "@prisma/client";
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireSession(req, inventoryOperators);
    const data = z.object({ productoId: z.string().min(1), ubicacionId: z.string().min(1), stockMinimo: z.number().finite().nonnegative().max(99999999.99) }).parse(await req.json());
    const minimum = new Prisma.Decimal(data.stockMinimo);
    if (minimum.decimalPlaces() > 2) throw new ApiError(400, "El mínimo admite hasta dos decimales.");
    const result = await prisma.$transaction(async tx => {
      await lockLocations(tx, [data.ubicacionId]);
      await locationForOperation(tx, user, data.ubicacionId);
      await lockProduct(tx, data.productoId);
      const row = await stockRow(tx, data.productoId, data.ubicacionId);
      const updated = await tx.existenciaInventario.update({ where: { id: row.id }, data: { stockMinimo: minimum } });
      await tx.auditoriaLog.create({ data: { usuarioId: user.id, modulo: "INVENTARIO", accion: "UPDATE", entidadTipo: "ExistenciaInventario", entidadId: row.id,
        valoresAnteriores: { stockMinimo: String(row.stockMinimo) }, valoresNuevos: { stockMinimo: String(minimum), ubicacionId: data.ubicacionId } } });
      return updated;
    });
    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}

import { requireSession, assertWorkAccess } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/api";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


// PATCH: Dictamen y Resolución de Reclamo de Garantía
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession(req, ["ADMIN", "ENCARGADO"]);
    const { id } = await params;
    const userId = session.id;

    const body = await req.json();
    const { solucionDetalle, estado, tecnicoAsignadoId, trabajoDerivadoId } = body;

    const existing = await prisma.reclamoGarantia.findUnique({ where: { id }, include: { trabajoOriginal: true } });
    if (!existing) throw new ApiError(404, "Reclamo no encontrado.");
    assertWorkAccess(session, existing.trabajoOriginal);
    const updated = await prisma.reclamoGarantia.update({
      where: { id },
      data: {
        solucionDetalle: solucionDetalle || undefined,
        estado: estado || "RESUELTO",
        tecnicoAsignadoId: tecnicoAsignadoId || undefined,
        trabajoDerivadoId: trabajoDerivadoId || undefined,
      },
    });

    // Auditoría
    if (userId) {
      await prisma.auditoriaLog.create({
        data: {
          usuarioId: userId,
          modulo: "GARANTIAS_RECLAMOS",
          accion: "UPDATE",
          entidadTipo: "ReclamoGarantia",
          entidadId: id,
          valoresNuevos: { estado: updated.estado, solucionDetalle },
        },
      });
    }

    return NextResponse.json({ success: true, reclamo: updated });
  } catch (error: any) {
    if (error instanceof ApiError) return apiError(error);
    console.error("Error resolviendo reclamo:", error);
    return NextResponse.json({ error: "Error al actualizar reclamo: " + error.message }, { status: 500 });
  }
}

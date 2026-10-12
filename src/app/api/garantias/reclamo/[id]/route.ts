import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "servigaz-secret-key-2026";

// PATCH: Dictamen y Resolución de Reclamo de Garantía
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = req.cookies.get("servigaz_token")?.value;
    let userId: string | null = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        userId = decoded.id;
      } catch (e) {}
    }

    if (!userId) {
      const admin = await prisma.usuario.findFirst({ where: { rol: "ADMIN" } });
      if (admin) userId = admin.id;
    }

    const body = await req.json();
    const { solucionDetalle, estado, tecnicoAsignadoId, trabajoDerivadoId } = body;

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
    console.error("Error resolviendo reclamo:", error);
    return NextResponse.json({ error: "Error al actualizar reclamo: " + error.message }, { status: 500 });
  }
}

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
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const body = await req.json();
    const { procedeGarantia, informeInspeccion, costoReparacion, estado } = body;

    const updated = await prisma.reclamoGarantia.update({
      where: { id },
      data: {
        procedeGarantia: procedeGarantia !== undefined ? Boolean(procedeGarantia) : undefined,
        informeInspeccion,
        costoReparacion: costoReparacion ? Number(costoReparacion) : undefined,
        estado: estado || (procedeGarantia ? "RESUELTO" : "RECHAZADO"),
        fechaResolucion: new Date(),
      },
    });

    // Auditoría
    await prisma.auditoriaLog.create({
      data: {
        usuarioId: decoded.id,
        modulo: "GARANTIAS_RECLAMOS",
        accion: "UPDATE",
        entidadTipo: "ReclamoGarantia",
        entidadId: id,
        valoresNuevos: { procedeGarantia, estado, informeInspeccion },
      },
    });

    return NextResponse.json({ success: true, reclamo: updated });
  } catch (error: any) {
    console.error("Error resolviendo reclamo:", error);
    return NextResponse.json({ error: "Error al actualizar reclamo" }, { status: 500 });
  }
}

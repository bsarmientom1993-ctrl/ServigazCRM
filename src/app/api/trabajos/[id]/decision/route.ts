import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "servigaz-secret-key-2026";

export async function POST(
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
        const userExists = await prisma.usuario.findUnique({ where: { id: decoded.id } });
        if (userExists) userId = decoded.id;
      } catch (e) {}
    }

    if (!userId) {
      const admin = await prisma.usuario.findFirst({ where: { rol: { in: ["ENCARGADO", "ADMIN"] } } });
      if (admin) userId = admin.id;
    }

    const trabajo = await prisma.trabajo.findUnique({
      where: { id },
      include: { cotizaciones: { where: { estado: "VIGENTE" }, take: 1 } },
    });

    if (!trabajo) {
      return NextResponse.json({ error: "Trabajo no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const { decision, motivoRechazo } = body; // 'APROBADO' | 'RECHAZADO'

    if (decision === "APROBADO" || decision === "APROBAR") {
      const updated = await prisma.trabajo.update({
        where: { id },
        data: { estado: "APROBADO" },
      });

      await prisma.auditoriaLog.create({
        data: {
          usuarioId: userId,
          modulo: "TRABAJOS",
          accion: "UPDATE",
          entidadTipo: "Trabajo",
          entidadId: id,
          valoresNuevos: { fase: 7, decision: "APROBADO" },
        },
      });

      return NextResponse.json({ success: true, trabajo: updated });
    }

    if (decision === "RECHAZADO" || decision === "RECHAZAR") {
      const updated = await prisma.trabajo.update({
        where: { id },
        data: {
          estado: "ARCHIVADO",
          motivoPausa: motivoRechazo || "Cotización rechazada por el cliente",
        },
      });

      await prisma.auditoriaLog.create({
        data: {
          usuarioId: userId,
          modulo: "TRABAJOS",
          accion: "UPDATE",
          entidadTipo: "Trabajo",
          entidadId: id,
          valoresNuevos: { fase: 7, decision: "RECHAZADO", motivo: motivoRechazo },
        },
      });

      return NextResponse.json({ success: true, trabajo: updated });
    }

    return NextResponse.json({ error: "Decisión no válida" }, { status: 400 });
  } catch (error: any) {
    console.error("Decision error:", error);
    return NextResponse.json({ error: "Error registrando decisión: " + error.message }, { status: 500 });
  }
}

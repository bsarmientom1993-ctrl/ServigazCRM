import { requireSession, assertWorkAccess } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/api";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


// GET: Validar Código de Garantía o QR
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const { codigo } = await params;

    const garantia = await prisma.certificadoGarantia.findFirst({
      where: {
        OR: [
          { codigoCertificado: codigo },
          { id: codigo },
          { qrCodeData: codigo },
        ],
      },
      select: {
        codigoCertificado: true, mesesCobertura: true, fechaInicio: true, fechaFin: true, activo: true,
        trabajo: { select: { subtipoNombre: true } },
      },
    });

    if (!garantia) {
      return NextResponse.json({ error: "Certificado de garantía no encontrado o código inválido." }, { status: 404 });
    }

    const ahora = new Date();
    const esVigente = ahora <= new Date(garantia.fechaFin) && garantia.activo;
    const diasRestantes = Math.max(0, Math.ceil((new Date(garantia.fechaFin).getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)));

    return NextResponse.json({
      garantia,
      esVigente,
      diasRestantes,
    });
  } catch (error: any) {
    if (error instanceof ApiError) return apiError(error);
    console.error("Error al validar garantía:", error);
    return NextResponse.json({ error: "Error al validar garantía" }, { status: 500 });
  }
}

// POST: Registrar Reclamo de Post-Venta
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const session = await requireSession(req, ["ADMIN", "ENCARGADO"]);
    const { codigo } = await params;
    const body = await req.json();
    const { descripcionFalla, tecnicoAsignadoId } = body;

    const userId = session.id;

    const garantia = await prisma.certificadoGarantia.findFirst({
      where: {
        OR: [
          { codigoCertificado: codigo },
          { id: codigo },
          { qrCodeData: codigo },
        ],
      },
      include: { trabajo: true },
    });

    if (!garantia) {
      return NextResponse.json({ error: "Certificado de garantía no encontrado" }, { status: 404 });
    }

    assertWorkAccess(session, garantia.trabajo);

    // SLA: 24 horas para primera atención de reclamo de gas
    const slaLimite = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const reclamo = await prisma.reclamoGarantia.create({
      data: {
        trabajoOriginalId: garantia.trabajoId,
        descripcionFalla: descripcionFalla || "Reclamo reportado por cliente en portal de garantía",
        slaLimiteFecha: slaLimite,
        estado: "PENDIENTE",
        tecnicoAsignadoId: tecnicoAsignadoId || garantia.trabajo.tecnicoId || null,
      },
    });

    if (userId) {
      await prisma.auditoriaLog.create({
        data: {
          usuarioId: userId,
          modulo: "GARANTIAS",
          accion: "CREATE",
          entidadTipo: "ReclamoGarantia",
          entidadId: reclamo.id,
          valoresNuevos: {
            trabajoId: garantia.trabajoId,
            codigoCertificado: garantia.codigoCertificado,
            descripcionFalla,
          },
        },
      });
    }

    return NextResponse.json({ success: true, reclamo });
  } catch (error: any) {
    if (error instanceof ApiError) return apiError(error);
    console.error("Error creando reclamo:", error);
    return NextResponse.json({ error: "Error al registrar reclamo de garantía: " + error.message }, { status: 500 });
  }
}

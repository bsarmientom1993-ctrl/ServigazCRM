import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "servigaz-secret-key-2026";

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
      include: {
        trabajo: {
          include: {
            cliente: true,
            tecnico: true,
            cotizaciones: { where: { estado: "VIGENTE" }, take: 1 },
          },
        },
      },
    });

    if (!garantia) {
      return NextResponse.json({ error: "Certificado de garantía no encontrado o código inválido." }, { status: 404 });
    }

    const ahora = new Date();
    const esVigente = ahora <= new Date(garantia.fechaFin) && garantia.activo;
    const diasRestantes = Math.max(0, Math.ceil((new Date(garantia.fechaFin).getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)));

    // Reclamos del trabajo original
    const reclamos = await prisma.reclamoGarantia.findMany({
      where: { trabajoOriginalId: garantia.trabajoId },
      include: { tecnicoAsignado: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      garantia,
      reclamos,
      esVigente,
      diasRestantes,
    });
  } catch (error) {
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
    const { codigo } = await params;
    const body = await req.json();
    const { descripcionFalla, tecnicoAsignadoId } = body;

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
    console.error("Error creando reclamo:", error);
    return NextResponse.json({ error: "Error al registrar reclamo de garantía: " + error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "servigaz-secret-key-2026";

// GET: Validar Código QR de Garantía
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const { codigo } = await params;

    const garantia = await prisma.certificadoGarantia.findFirst({
      where: {
        OR: [
          { codigoQR: codigo },
          { id: codigo },
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
        reclamos: {
          orderBy: { createdAt: "desc" },
          include: { tecnicoAsignado: true },
        },
      },
    });

    if (!garantia) {
      return NextResponse.json({ error: "Certificado de garantía no encontrado o código QR inválido." }, { status: 404 });
    }

    const ahora = new Date();
    const esVigente = ahora <= new Date(garantia.fechaVencimiento) && garantia.estado === "VIGENTE";

    return NextResponse.json({
      garantia,
      esVigente,
      diasRestantes: Math.max(0, Math.ceil((new Date(garantia.fechaVencimiento).getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24))),
    });
  } catch (error) {
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
    const { descripcionFalla, fotosUrls, tecnicoAsignadoId } = body;

    const token = req.cookies.get("servigaz_token")?.value;
    let userId = "cliente-portal";
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      userId = decoded.id;
    }

    const garantia = await prisma.certificadoGarantia.findFirst({
      where: {
        OR: [
          { codigoQR: codigo },
          { id: codigo },
        ],
      },
      include: { trabajo: true },
    });

    if (!garantia) {
      return NextResponse.json({ error: "Certificado de garantía no encontrado" }, { status: 404 });
    }

    // Crear Reclamo (Fase 22-B)
    const reclamo = await prisma.reclamoGarantia.create({
      data: {
        certificadoId: garantia.id,
        descripcionFalla,
        fotosUrls: fotosUrls || [],
        estado: "PENDIENTE",
        procedeGarantia: null, // Pendiente de inspección
        tecnicoAsignadoId: tecnicoAsignadoId || garantia.trabajo.tecnicoId,
      },
    });

    // Auditoría
    await prisma.auditoriaLog.create({
      data: {
        usuarioId: userId,
        modulo: "GARANTIAS_RECLAMOS",
        accion: "CREATE",
        entidadTipo: "ReclamoGarantia",
        entidadId: reclamo.id,
        valoresNuevos: {
          garantiaId: garantia.id,
          codigoQR: garantia.codigoQR,
          descripcionFalla,
        },
      },
    });

    return NextResponse.json({ success: true, reclamo });
  } catch (error: any) {
    console.error("Error creando reclamo:", error);
    return NextResponse.json({ error: "Error al registrar reclamo de garantía" }, { status: 500 });
  }
}

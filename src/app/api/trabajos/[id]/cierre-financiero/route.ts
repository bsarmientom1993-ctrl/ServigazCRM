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
      include: {
        materiales: true,
        pagos: true,
        egreso: true,
        garantia: true,
        cliente: true,
      },
    });

    if (!trabajo) {
      return NextResponse.json({ error: "Trabajo no encontrado" }, { status: 404 });
    }

    // Si ya tiene egreso y garantía, retornar éxito inmediatamente
    if (trabajo.egreso) {
      return NextResponse.json({
        success: true,
        egreso: trabajo.egreso,
        utilidadReal: Number(trabajo.egreso.utilidadNeta),
        garantia: trabajo.garantia,
        yaCerrado: true,
      });
    }

    const body = await req.json();
    const { costoManoObraReal, costoTransporteReal } = body;

    // Materiales clasificados
    const matInventario = trabajo.materiales.filter((m) => m.esDeInventario);
    const matManuales = trabajo.materiales.filter((m) => !m.esDeInventario);

    const totalMat = trabajo.materiales.reduce((acc, m) => acc + Number(m.subtotalCosto), 0);
    const moReal = Number(costoManoObraReal || 0);
    const transpReal = Number(costoTransporteReal || 0);
    const totalEgreso = totalMat + moReal + transpReal;

    const totalIngreso = trabajo.pagos.reduce((acc, p) => acc + Number(p.monto), 0);
    const utilidadNeta = totalIngreso - totalEgreso;
    const alertaMargenNegativo = utilidadNeta < 0;

    // Crear EgresoTrabajo Inmutable
    const egreso = await prisma.egresoTrabajo.create({
      data: {
        trabajoId: id,
        materialesInventarioJson: matInventario.map((m) => ({
          descripcion: m.descripcion,
          cantidad: Number(m.cantidad),
          costoUnitario: Number(m.costoUnitario),
          subtotal: Number(m.subtotalCosto),
        })),
        materialesManualesJson: matManuales.map((m) => ({
          descripcion: m.descripcion,
          cantidad: Number(m.cantidad),
          costoUnitario: Number(m.costoUnitario),
          subtotal: Number(m.subtotalCosto),
          proveedor: m.proveedorNombre,
        })),
        manoObraMonto: moReal,
        transporteMonto: transpReal,
        totalEgreso,
        totalIngreso,
        utilidadNeta,
        alertaMargenNegativo,
        bloqueado: true,
        generadoPor: userId || "SISTEMA",
      },
    });

    // Actualizar trabajo a FINALIZADO_FINANCIERO
    await prisma.trabajo.update({
      where: { id },
      data: { estado: "FINALIZADO_FINANCIERO" },
    });

    // Garantía automática
    let garantia = trabajo.garantia;
    if (!garantia) {
      const fechaInicio = new Date();
      const fechaFin = new Date();
      fechaFin.setFullYear(fechaFin.getFullYear() + 1); // 12 meses

      const codigoCertificado = `GAR-${trabajo.codigoCorrelativo}`;
      const qrCodeData = `https://servigaz.bo/garantia/${codigoCertificado}`;

      garantia = await prisma.certificadoGarantia.create({
        data: {
          trabajoId: id,
          codigoCertificado,
          mesesCobertura: 12,
          fechaInicio,
          fechaFin,
          qrCodeData,
          activo: true,
        },
      });
    }

    // Auditoría
    if (userId) {
      await prisma.auditoriaLog.create({
        data: {
          usuarioId: userId,
          modulo: "CIERRE_FINANCIERO",
          accion: "CREATE",
          entidadTipo: "EgresoTrabajo",
          entidadId: egreso.id,
          valoresNuevos: {
            trabajoId: id,
            totalIngreso,
            totalEgreso,
            utilidadNeta,
            garantiaId: garantia.id,
            codigoCertificado: garantia.codigoCertificado,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      egreso,
      utilidadReal: utilidadNeta,
      garantia,
    });
  } catch (error: any) {
    console.error("Error en cierre financiero:", error);
    return NextResponse.json({ error: "Error al finalizar trabajo: " + error.message }, { status: 500 });
  }
}

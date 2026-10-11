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
      include: { cotizaciones: true },
    });

    if (!trabajo) {
      return NextResponse.json({ error: "Trabajo no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    let {
      datosFormulario,
      snapshotCalculo,
      subtotalMateriales,
      subtotalManoObra,
      montoTransporte,
      porcentajeDescuento,
      montoDescuento,
      totalCotizado,
      anticipoMinimo,
      alertaBajoMargen,
      justificacionMargenBajo,
    } = body;

    const subMat = Number(subtotalMateriales || 0);
    const subMo = Number(subtotalManoObra || 0);
    const mTrans = Number(montoTransporte || 0);
    const descPct = Number(porcentajeDescuento || 0);
    const subBruto = subMat + subMo + mTrans;
    const descMonto = Number(montoDescuento || (subBruto * descPct) / 100);
    const totalFinal = Number(totalCotizado || subBruto - descMonto);
    const anticipoReq = Number(anticipoMinimo || totalFinal * 0.5);

    // Validación regla #94: justificación obligatoria si bajo margen
    if (alertaBajoMargen && (!justificacionMargenBajo || justificacionMargenBajo.trim().length < 5)) {
      return NextResponse.json(
        { error: "Regla #94: Margen inferior al 20%. La justificación comercial es obligatoria." },
        { status: 400 }
      );
    }

    // Calcular fecha de vencimiento (15 días corridos)
    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 15);

    const numeroVersion = (trabajo.cotizaciones?.length || 0) + 1;

    // Crear Cotización con Snapshot Inmutable
    const cotizacion = await prisma.cotizacion.create({
      data: {
        trabajoId: id,
        numeroVersion,
        tipoVersion: numeroVersion === 1 ? "ORIGINAL" : "CORRECCION",
        datosFormularioJson: datosFormulario || {},
        snapshotCalculoJson: snapshotCalculo || {},
        subtotalMateriales: subMat,
        subtotalManoObra: subMo,
        montoTransporte: mTrans,
        porcentajeDescuento: descPct,
        montoDescuento: descMonto,
        descuentoAprobadoPor: descPct > 10 ? userId : null,
        totalCotizado: totalFinal,
        anticipoMinimoRequerido: anticipoReq,
        alertaBajoMargen: Boolean(alertaBajoMargen),
        justificacionMargenBajo,
        fechaVencimiento,
        estado: "VIGENTE",
      },
    });

    // Actualizar estado del trabajo a COTIZADO
    const updatedTrabajo = await prisma.trabajo.update({
      where: { id },
      data: {
        estado: "COTIZADO",
      },
    });

    // Auditoría
    await prisma.auditoriaLog.create({
      data: {
        usuarioId: userId,
        modulo: "COTIZACIONES",
        accion: "CREATE",
        entidadTipo: "Cotizacion",
        entidadId: cotizacion.id,
        valoresNuevos: {
          trabajoId: id,
          totalCotizado: totalFinal,
          numeroVersion,
          descuento: descPct,
        },
      },
    });

    return NextResponse.json({
      success: true,
      cotizacion,
      totalCotizado: totalFinal,
      anticipoMinimoRequerido: anticipoReq,
      trabajo: updatedTrabajo,
    });
  } catch (error: any) {
    console.error("Error guardando cotización:", error);
    return NextResponse.json({ error: "Error al emitir cotización: " + error.message }, { status: 500 });
  }
}

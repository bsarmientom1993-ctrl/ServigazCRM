import { requireSession } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/api";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/finanzas/balance — Estado de Resultados Consolidado en Bs.
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req, ["ADMIN"]);
    // 1. Total Ingresos Recibidos en Caja/Banco (Pagos)
    const pagos = await prisma.pago.findMany({
      select: {
        id: true,
        monto: true,
        tipoPago: true,
        metodoPago: true,
        fechaPago: true,
      },
    });

    const totalIngresos = pagos.reduce((acc, p) => acc + Number(p.monto), 0);

    // Desglose de ingresos por método
    const ingresosPorMetodo = pagos.reduce((acc: any, p) => {
      acc[p.metodoPago] = (acc[p.metodoPago] || 0) + Number(p.monto);
      return acc;
    }, {});

    // 2. Total Egresos de Faenas / Trabajos (EgresoTrabajo #84)
    const egresosTrabajos = await prisma.egresoTrabajo.findMany({
      include: {
        trabajo: {
          select: {
            codigoCorrelativo: true,
            subtipoNombre: true,
            cliente: { select: { nombreCompleto: true } },
          },
        },
      },
      orderBy: { fechaGeneracion: "desc" },
    });

    const totalEgresosFaenas = egresosTrabajos.reduce((acc, e) => acc + Number(e.totalEgreso), 0);
    const totalManoObraFaenas = egresosTrabajos.reduce((acc, e) => acc + Number(e.manoObraMonto || 0), 0);
    const totalTransporteFaenas = egresosTrabajos.reduce((acc, e) => acc + Number(e.transporteMonto || 0), 0);
    const totalMaterialesFaenas = Math.max(0, totalEgresosFaenas - totalManoObraFaenas - totalTransporteFaenas);

    // 3. Total Egresos Generales / Operativos de Oficina (EgresoGeneralManual)
    const egresosGenerales = await prisma.egresoGeneralManual.findMany({
      orderBy: { fechaEgreso: "desc" },
    });

    const totalEgresosOperativos = egresosGenerales.reduce((acc, e) => acc + Number(e.monto), 0);

    const gastosPorCategoria = egresosGenerales.reduce((acc: any, e) => {
      acc[e.categoria] = (acc[e.categoria] || 0) + Number(e.monto);
      return acc;
    }, {});

    // 4. Totales Consolidados y Utilidad Neta
    const totalEgresosGlobales = totalEgresosFaenas + totalEgresosOperativos;
    const utilidadNetaGlobal = totalIngresos - totalEgresosGlobales;
    const margenNetoPct = totalIngresos > 0 ? (utilidadNetaGlobal / totalIngresos) * 100 : 0;

    return NextResponse.json({
      resumen: {
        totalIngresos,
        totalEgresosGlobales,
        totalEgresosFaenas,
        totalEgresosOperativos,
        utilidadNetaGlobal,
        margenNetoPct: Number(margenNetoPct.toFixed(2)),
      },
      desgloseFaenas: {
        totalMateriales: totalMaterialesFaenas,
        totalManoObra: totalManoObraFaenas,
        totalTransporte: totalTransporteFaenas,
        cantidadFaenasCerradas: egresosTrabajos.length,
      },
      desgloseOperativo: {
        porCategoria: gastosPorCategoria,
        cantidadGastosRegistrados: egresosGenerales.length,
      },
      desgloseMetodosPago: ingresosPorMetodo,
      ultimosGastosOperativos: egresosGenerales.slice(0, 5),
      ultimasFaenasCerradas: egresosTrabajos.slice(0, 5),
    });
  } catch (error: any) {
    if (error instanceof ApiError) return apiError(error);
    console.error("Error al calcular balance:", error);
    return NextResponse.json({ error: "Error al generar estado de resultados" }, { status: 500 });
  }
}

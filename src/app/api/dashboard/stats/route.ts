import { requireSession, workScope } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/api";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req);
    const scope = workScope(session);

    // Métricas globales
    const totalTrabajos = await prisma.trabajo.count({ where: scope });
    const trabajosActivos = await prisma.trabajo.count({
      where: {
        AND: [scope],
        estado: {
          in: ["EN_PROCESO", "ANTICIPO_RECIBIDO", "EVALUACION_PENDIENTE", "EVALUADO", "COTIZADO", "APROBADO"],
        },
      },
    });

    const totalClientes = session.rol === "TECNICO_FIJO" ? 0 : await prisma.cliente.count({ where: session.rol === "ADMIN" ? {} : { sucursalId: session.sucursalId } });
    const totalProductos = await prisma.productoInventario.count({ where: { activo: true } });
    
    // Alertas stock bajo
    const productosStockBajo = await prisma.productoInventario.count({
      where: {
        activo: true,
        stockActual: { lte: prisma.productoInventario.fields.stockMinimo },
      },
    });

    // Últimos trabajos
    const ultimosTrabajos = await prisma.trabajo.findMany({
      where: scope,
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        cliente: { select: { nombreCompleto: true, nivelFidelizacion: true } },
        encargado: { select: { nombre: true } },
        tecnico: { select: { nombre: true } },
      },
    });

    // Asistencia de hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const asistenciasHoy = await prisma.asistenciaPersonal.count({
      where: { fecha: { gte: today }, ...(session.rol === "ADMIN" ? {} : { usuarioId: session.id }) },
    });

    return NextResponse.json({
      metrics: {
        totalTrabajos,
        trabajosActivos,
        totalClientes,
        totalProductos,
        productosStockBajo,
        asistenciasHoy,
      },
      ultimosTrabajos,
    });
  } catch (error: any) {
    if (error instanceof ApiError) return apiError(error);
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: "Error al cargar estadísticas" }, { status: 500 });
  }
}

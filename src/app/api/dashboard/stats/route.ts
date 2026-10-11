import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "servigaz-secret-key-2026";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("servigaz_token")?.value;
    if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userRole = decoded.rol;
    const userId = decoded.id;

    // Métricas globales
    const totalTrabajos = await prisma.trabajo.count();
    const trabajosActivos = await prisma.trabajo.count({
      where: {
        estado: {
          in: ["EN_PROCESO", "ANTICIPO_RECIBIDO", "EVALUACION_PENDIENTE", "EVALUADO", "COTIZADO", "APROBADO"],
        },
      },
    });

    const totalClientes = await prisma.cliente.count();
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
      where: { fecha: { gte: today } },
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
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: "Error al cargar estadísticas" }, { status: 500 });
  }
}

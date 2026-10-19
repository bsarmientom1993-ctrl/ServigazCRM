import { requireSession } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/api";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


// GET /api/finanzas — Listar egresos generales con regla de privacidad #91
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req, ["ADMIN", "ENCARGADO"]);
    const userId = session.id;
    const userRole = session.rol;

    // Regla #91: Admin ve todos los egresos; Encargado ve solo los creados por él
    const whereClause: any = {};
    if (userRole !== "ADMIN" && userId) {
      whereClause.creadoPorId = userId;
    }

    const { searchParams } = new URL(req.url);
    const categoria = searchParams.get("categoria");
    const esRecurrente = searchParams.get("esRecurrente");

    if (categoria) whereClause.categoria = categoria;
    if (esRecurrente !== null && esRecurrente !== undefined) {
      whereClause.esRecurrente = esRecurrente === "true";
    }

    const egresos = await prisma.egresoGeneralManual.findMany({
      where: whereClause,
      include: {
        creadoPor: {
          select: { id: true, nombre: true, email: true, rol: true },
        },
      },
      orderBy: { fechaEgreso: "desc" },
    });

    // Calcular totales por categoría
    const totalEgresos = egresos.reduce((acc, e) => acc + Number(e.monto), 0);
    const porCategoria = egresos.reduce((acc: any, e) => {
      acc[e.categoria] = (acc[e.categoria] || 0) + Number(e.monto);
      return acc;
    }, {});

    return NextResponse.json({
      egresos,
      totalEgresos,
      porCategoria,
      totalRegistros: egresos.length,
    });
  } catch (error: any) {
    if (error instanceof ApiError) return apiError(error);
    console.error("Error al listar egresos:", error);
    return NextResponse.json({ error: "Error al consultar egresos" }, { status: 500 });
  }
}

// POST /api/finanzas — Registrar nuevo egreso general
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req, ["ADMIN", "ENCARGADO"]);
    const userId = session.id;

    const body = await req.json();
    const { categoria, monto, descripcion, proveedorInfo, comprobanteUrl, esRecurrente, fechaEgreso } = body;

    const montoNum = Number(monto);
    if (!montoNum || montoNum <= 0) {
      return NextResponse.json({ error: "El monto debe ser mayor a Bs. 0" }, { status: 400 });
    }

    if (!descripcion?.trim()) {
      return NextResponse.json({ error: "La descripción del gasto es obligatoria" }, { status: 400 });
    }

    const nuevoEgreso = await prisma.egresoGeneralManual.create({
      data: {
        categoria: categoria || "OTROS",
        monto: montoNum,
        descripcion: descripcion.trim(),
        proveedorInfo: proveedorInfo?.trim() || null,
        comprobanteUrl: comprobanteUrl || null,
        esRecurrente: Boolean(esRecurrente),
        creadoPorId: userId,
        fechaEgreso: fechaEgreso ? new Date(fechaEgreso) : new Date(),
      },
      include: {
        creadoPor: {
          select: { id: true, nombre: true, email: true, rol: true },
        },
      },
    });

    // Auditoría
    await prisma.auditoriaLog.create({
      data: {
        usuarioId: userId,
        modulo: "FINANZAS",
        accion: "CREATE",
        entidadTipo: "EgresoGeneralManual",
        entidadId: nuevoEgreso.id,
        valoresNuevos: {
          categoria: nuevoEgreso.categoria,
          monto: montoNum,
          descripcion: nuevoEgreso.descripcion,
          proveedorInfo: nuevoEgreso.proveedorInfo,
        },
      },
    });

    return NextResponse.json({ success: true, egreso: nuevoEgreso }, { status: 201 });
  } catch (error: any) {
    if (error instanceof ApiError) return apiError(error);
    console.error("Error al registrar egreso:", error);
    return NextResponse.json({ error: "Error al registrar gasto: " + error.message }, { status: 500 });
  }
}

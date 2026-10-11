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
      include: { materiales: true },
    });

    if (!trabajo) {
      return NextResponse.json({ error: "Trabajo no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const { accion, data } = body;

    // 1. INICIAR EJECUCIÓN (Fase 9)
    if (accion === "INICIAR_EJECUCION") {
      const updated = await prisma.trabajo.update({
        where: { id },
        data: {
          estado: "EN_PROCESO",
          fechaInicioEjecucion: new Date(),
        },
      });

      await prisma.auditoriaLog.create({
        data: {
          usuarioId: userId,
          modulo: "EJECUCION",
          accion: "UPDATE",
          entidadTipo: "Trabajo",
          entidadId: id,
          valoresNuevos: { fase: 9, estado: "EN_PROCESO" },
        },
      });

      return NextResponse.json({ success: true, trabajo: updated });
    }

    // 2. REGISTRAR MATERIAL CONSUMIDO (Fase 9 / Regla #93)
    if (accion === "REGISTRAR_MATERIAL") {
      const {
        descripcion,
        cantidad,
        costoUnitario,
        esDeInventario,
        productoId,
        proveedorNombre,
        proveedorContacto,
      } = data || {};

      if (!descripcion || !descripcion.trim()) {
        return NextResponse.json({ error: "Debe ingresar la descripción o nombre del material" }, { status: 400 });
      }

      const cantidadNum = Number(cantidad || 1);
      const costoUnitarioNum = Number(costoUnitario || 0);
      const subtotalCosto = cantidadNum * costoUnitarioNum;

      // Si es de inventario, descontar stock y registrar movimiento
      if (esDeInventario && productoId) {
        const prod = await prisma.productoInventario.findUnique({ where: { id: productoId } });
        if (prod) {
          if (prod.stockActual < cantidadNum) {
            return NextResponse.json(
              { error: `Stock insuficiente en almacén (Disponible: ${prod.stockActual} ${prod.unidadMedida || prod.unidad || "un"})` },
              { status: 400 }
            );
          }

          const nuevoStock = prod.stockActual - cantidadNum;
          await prisma.productoInventario.update({
            where: { id: productoId },
            data: { stockActual: nuevoStock },
          });

          if (userId) {
            await prisma.movimientoInventario.create({
              data: {
                productoId,
                tipoMovimiento: "CONSUMO_TRABAJO",
                cantidad: cantidadNum,
                costoUnitario: costoUnitarioNum,
                trabajoId: id,
                usuarioId: userId,
                observaciones: `Consumo en trabajo ${trabajo.codigoCorrelativo}`,
              },
            });
          }
        }
      }

      // Crear registro exacto de material
      const mat = await prisma.materialEjecucion.create({
        data: {
          trabajoId: id,
          tipoOrigen: esDeInventario ? "INVENTARIO" : "MANUAL_FUERA_INVENTARIO",
          productoId: esDeInventario && productoId ? productoId : null,
          descripcion: descripcion.trim(),
          cantidad: cantidadNum,
          costoUnitario: costoUnitarioNum,
          subtotalCosto,
          proveedorNombre: proveedorNombre || null,
          proveedorContacto: proveedorContacto || null,
          consumido: true,
        },
      });

      return NextResponse.json({ success: true, material: mat });
    }

    // 3. TÉRMINO TÉCNICO (Fase 11)
    if (accion === "FINALIZAR_TECNICO") {
      const { fotosTermino, observacionesTermino } = data || {};

      const finalFotos = Array.isArray(fotosTermino) && fotosTermino.length >= 2
        ? fotosTermino
        : [
            "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80",
            "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=400&q=80",
          ];

      const updated = await prisma.trabajo.update({
        where: { id },
        data: {
          estado: "TERMINADO_TECNICO",
          fechaFinEjecucion: new Date(),
          observaciones: `${trabajo.observaciones || ""} [Término Técnico: ${observacionesTermino || "Trabajo finalizado y conforme"}]`,
        },
      });

      return NextResponse.json({ success: true, trabajo: updated });
    }

    // 4. VALIDACIÓN DE CALIDAD ENCARGADO (Fase 12)
    if (accion === "VALIDAR_ENCARGADO") {
      const updated = await prisma.trabajo.update({
        where: { id },
        data: { estado: "VALIDADO" },
      });

      return NextResponse.json({ success: true, trabajo: updated });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (error: any) {
    console.error("Ejecucion error:", error);
    return NextResponse.json({ error: "Error en ejecución de obra: " + error.message }, { status: 500 });
  }
}

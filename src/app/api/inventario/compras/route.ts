import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "servigaz-secret-key-2026";

// GET /api/inventario/compras — Listar historial de compras a proveedores oficiales (#96)
export async function GET(req: NextRequest) {
  try {
    const compras = await prisma.movimientoInventario.findMany({
      where: {
        tipoMovimiento: "COMPRA",
      },
      include: {
        producto: {
          select: {
            id: true,
            codigoSku: true,
            nombre: true,
            categoria: true,
            unidadMedida: true,
            costoPromedio: true,
            stockActual: true,
          },
        },
        usuario: {
          select: {
            id: true,
            nombre: true,
            email: true,
          },
        },
      },
      orderBy: { fecha: "desc" },
    });

    const totalInvertidoCompras = compras.reduce((acc, c) => {
      // Si en observaciones o cálculo hay monto, sumamos
      const cant = Number(c.cantidad);
      const costo = Number(c.producto.costoPromedio);
      return acc + cant * costo;
    }, 0);

    return NextResponse.json({
      compras,
      totalComprasRegistradas: compras.length,
      totalInvertidoAprox: totalInvertidoCompras,
    });
  } catch (error: any) {
    console.error("Error al listar compras:", error);
    return NextResponse.json({ error: "Error al consultar historial de compras" }, { status: 500 });
  }
}

// POST /api/inventario/compras — Registrar compra a proveedor oficial con recálculo de costo ponderado (#96)
export async function POST(req: NextRequest) {
  try {
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
      const admin = await prisma.usuario.findFirst({ where: { rol: { in: ["ADMIN", "ENCARGADO"] } } });
      if (admin) userId = admin.id;
      else {
        const anyUser = await prisma.usuario.findFirst();
        if (anyUser) userId = anyUser.id;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Usuario no autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const {
      productoId,
      cantidad,
      precioCompraUnitario,
      proveedorNombre,
      proveedorContacto,
      numeroDocumento,
      observaciones,
      registrarEgresoCaja,
    } = body;

    const cantNum = Number(cantidad);
    const precioCompraNum = Number(precioCompraUnitario);

    if (!productoId) {
      return NextResponse.json({ error: "Debes seleccionar un producto del inventario" }, { status: 400 });
    }

    if (!cantNum || cantNum <= 0) {
      return NextResponse.json({ error: "La cantidad comprada debe ser mayor a 0" }, { status: 400 });
    }

    if (!precioCompraNum || precioCompraNum <= 0) {
      return NextResponse.json({ error: "El precio unitario de compra debe ser mayor a Bs. 0" }, { status: 400 });
    }

    if (!proveedorNombre?.trim()) {
      return NextResponse.json({ error: "El nombre o razón social del proveedor es obligatorio (Regla #96)" }, { status: 400 });
    }

    // Obtener producto actual
    const producto = await prisma.productoInventario.findUnique({
      where: { id: productoId },
    });

    if (!producto) {
      return NextResponse.json({ error: "Producto no encontrado en inventario" }, { status: 404 });
    }

    const stockAnterior = Number(producto.stockActual);
    const costoAnterior = Number(producto.costoPromedio);
    const stockNuevo = stockAnterior + cantNum;

    // Fórmula del Costo Promedio Ponderado:
    // Nuevo Costo = ((Stock Anterior * Costo Anterior) + (Cantidad Comprada * Precio Compra)) / Stock Nuevo
    let nuevoCostoPromedio = precioCompraNum;
    if (stockAnterior > 0 && stockNuevo > 0) {
      const valorStockAnterior = stockAnterior * costoAnterior;
      const valorCompraNueva = cantNum * precioCompraNum;
      nuevoCostoPromedio = Number(((valorStockAnterior + valorCompraNueva) / stockNuevo).toFixed(2));
    }

    // 1. Actualizar Producto en Inventario
    const productoActualizado = await prisma.productoInventario.update({
      where: { id: productoId },
      data: {
        stockActual: stockNuevo,
        costoPromedio: nuevoCostoPromedio,
      },
    });

    // 2. Registrar Movimiento de Inventario tipo COMPRA
    const nuevoMovimiento = await prisma.movimientoInventario.create({
      data: {
        productoId,
        tipoMovimiento: "COMPRA",
        cantidad: cantNum,
        stockAnterior,
        stockNuevo,
        proveedorNombre: proveedorNombre.trim(),
        proveedorContacto: proveedorContacto?.trim() || null,
        observaciones: `Factura/Doc: ${numeroDocumento || "S/N"} — Costo Compra: Bs. ${precioCompraNum} c/u — ${observaciones || ""}`.trim(),
        usuarioId: userId,
      },
    });

    // 3. Registrar Egreso Financiero en Caja si se solicitó
    let egresoGenerado = null;
    const totalCompra = cantNum * precioCompraNum;
    if (registrarEgresoCaja) {
      egresoGenerado = await prisma.egresoGeneralManual.create({
        data: {
          categoria: "INVENTARIO_COMPRAS",
          monto: totalCompra,
          descripcion: `Compra Insumos: ${cantNum} ${producto.unidadMedida} de "${producto.nombre}" (${numeroDocumento ? `Doc: ${numeroDocumento}` : "S/Doc"})`,
          proveedorInfo: `${proveedorNombre.trim()}${proveedorContacto ? ` • Tel/NIT: ${proveedorContacto.trim()}` : ""}`,
          creadoPorId: userId,
          esRecurrente: false,
        },
      });
    }

    // 4. Auditoría
    await prisma.auditoriaLog.create({
      data: {
        usuarioId: userId,
        modulo: "INVENTARIO",
        accion: "CREATE",
        entidadTipo: "MovimientoInventario",
        entidadId: nuevoMovimiento.id,
        valoresNuevos: {
          producto: producto.nombre,
          cantidad: cantNum,
          precioCompra: precioCompraNum,
          stockAnterior,
          stockNuevo,
          costoAnterior,
          nuevoCostoPromedio,
          proveedor: proveedorNombre,
        },
      },
    });

    return NextResponse.json({
      success: true,
      movimiento: nuevoMovimiento,
      producto: productoActualizado,
      egresoFinanciero: egresoGenerado,
      resumen: {
        cantidadComprada: cantNum,
        precioUnitarioCompra: precioCompraNum,
        totalInvertido: totalCompra,
        stockAnterior,
        stockNuevo,
        costoPromedioAnterior: costoAnterior,
        nuevoCostoPromedio,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error al registrar compra:", error);
    return NextResponse.json({ error: "Error al registrar compra a proveedor: " + error.message }, { status: 500 });
  }
}

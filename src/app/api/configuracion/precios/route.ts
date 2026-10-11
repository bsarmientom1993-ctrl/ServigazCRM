import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "servigaz-secret-key-2026";

// GET: Carga todas las reglas de negocio y precios
export async function GET() {
  try {
    const precios = await prisma.configuracionPrecio.findMany({
      orderBy: [{ subtipoCodigo: "asc" }, { concepto: "asc" }],
    });
    const manoObra = await prisma.configuracionManoObra.findMany({
      orderBy: { subtipoCodigo: "asc" },
    });
    const dificultades = await prisma.configuracionDificultad.findMany({
      orderBy: { nivel: "asc" },
    });
    const garantias = await prisma.configuracionGarantia.findMany({
      orderBy: { subtipoCodigo: "asc" },
    });
    const configGeneral = await prisma.configuracionGeneral.findFirst();
    const configDescuento = await prisma.configuracionDescuento.findFirst();
    const configAnticipo = await prisma.configuracionAnticipo.findMany();

    return NextResponse.json({
      precios,
      manoObra,
      dificultades,
      garantias,
      configGeneral,
      configDescuento,
      configAnticipo,
    });
  } catch (error) {
    return NextResponse.json({ error: "Error al cargar configuración" }, { status: 500 });
  }
}

// POST: Modificación de Reglas y Precios (Solo Gerente / Admin)
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("servigaz_token")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.rol !== "ADMIN") {
      return NextResponse.json(
        { error: "Solo el Gerente / Administrador puede modificar reglas y tarifas." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { tipo, data } = body;

    // 1. REGLA: PRECIO POR CONCEPTO / MATERIAL
    if (tipo === "PRECIO") {
      const { id, subtipoCodigo, concepto, precioUnitario, unidad, diametro, material } = data;
      let item;
      if (id) {
        item = await prisma.configuracionPrecio.update({
          where: { id },
          data: {
            subtipoCodigo,
            concepto,
            precioUnitario: Number(precioUnitario),
            unidad,
            diametro,
            material,
            modificadoPor: decoded.id,
          },
        });
      } else {
        item = await prisma.configuracionPrecio.create({
          data: {
            subtipoCodigo,
            concepto,
            precioUnitario: Number(precioUnitario),
            unidad,
            diametro,
            material,
            activo: true,
            modificadoPor: decoded.id,
          },
        });
      }

      await prisma.auditoriaLog.create({
        data: {
          usuarioId: decoded.id,
          modulo: "CONFIGURACION_PRECIOS",
          accion: id ? "UPDATE" : "CREATE",
          entidadTipo: "ConfiguracionPrecio",
          entidadId: item.id,
          valoresNuevos: { concepto, precioUnitario, unidad },
        },
      });

      return NextResponse.json({ success: true, item });
    }

    // 2. REGLA: MANO DE OBRA Y CRITERIO DE CÁLCULO
    if (tipo === "MANO_OBRA") {
      const { id, subtipoCodigo, tipoCalculo, tarifaBase, factorDificultad } = data;
      let item;
      if (id) {
        item = await prisma.configuracionManoObra.update({
          where: { id },
          data: {
            tipoCalculo,
            tarifaBase: Number(tarifaBase),
            factorDificultad: Number(factorDificultad || 1.0),
            modificadoPor: decoded.id,
          },
        });
      } else {
        item = await prisma.configuracionManoObra.create({
          data: {
            subtipoCodigo,
            tipoCalculo,
            tarifaBase: Number(tarifaBase),
            factorDificultad: Number(factorDificultad || 1.0),
            modificadoPor: decoded.id,
          },
        });
      }

      await prisma.auditoriaLog.create({
        data: {
          usuarioId: decoded.id,
          modulo: "CONFIGURACION_MANO_OBRA",
          accion: "UPDATE",
          entidadTipo: "ConfiguracionManoObra",
          entidadId: item.id,
          valoresNuevos: { subtipoCodigo, tipoCalculo, tarifaBase },
        },
      });

      return NextResponse.json({ success: true, item });
    }

    // 3. REGLA: FACTORES DE DIFICULTAD
    if (tipo === "DIFICULTAD") {
      const { id, nivel, factorMultiplicador, descripcion, sugerenciaInstaladorExtra } = data;
      const item = await prisma.configuracionDificultad.update({
        where: { nivel: Number(nivel) },
        data: {
          factorMultiplicador: Number(factorMultiplicador),
          descripcion,
          sugerenciaInstaladorExtra: Boolean(sugerenciaInstaladorExtra),
          modificadoPor: decoded.id,
        },
      });

      await prisma.auditoriaLog.create({
        data: {
          usuarioId: decoded.id,
          modulo: "CONFIGURACION_DIFICULTAD",
          accion: "UPDATE",
          entidadTipo: "ConfiguracionDificultad",
          entidadId: item.id,
          valoresNuevos: { nivel, factorMultiplicador, sugerenciaInstaladorExtra },
        },
      });

      return NextResponse.json({ success: true, item });
    }

    // 4. REGLA: PARÁMETROS COMERCIALES Y MARGEN (GENERAL)
    if (tipo === "GENERAL") {
      const { margenMinimoPct, alertaBajoMargenUmbralPct, topeMaximoPct, pctMaxEncargado } = data;

      const general = await prisma.configuracionGeneral.findFirst();
      if (general) {
        await prisma.configuracionGeneral.update({
          where: { id: general.id },
          data: {
            margenMinimoPct: Number(margenMinimoPct),
            alertaBajoMargenUmbralPct: Number(alertaBajoMargenUmbralPct),
            modificadoPor: decoded.id,
          },
        });
      }

      const desc = await prisma.configuracionDescuento.findFirst();
      if (desc) {
        await prisma.configuracionDescuento.update({
          where: { id: desc.id },
          data: {
            topeMaximoPct: Number(topeMaximoPct),
            pctMaxEncargado: Number(pctMaxEncargado),
            modificadoPor: decoded.id,
          },
        });
      }

      await prisma.auditoriaLog.create({
        data: {
          usuarioId: decoded.id,
          modulo: "CONFIGURACION_GENERAL",
          accion: "UPDATE",
          entidadTipo: "ReglasComerciales",
          valoresNuevos: data,
        },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Tipo de regla no válido" }, { status: 400 });
  } catch (error: any) {
    console.error("Config save error:", error);
    return NextResponse.json({ error: "Error al guardar regla" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "servigaz-secret-key-2026";

const CATALOGO_INICIAL = [
  {
    codigo: "GAS",
    nombre: "Instalaciones de Gas",
    descripcion: "Redes nuevas, modificaciones, gabinetes y normativa SEC.",
    icono: "Flame",
    color: "orange",
    requiereVisita: true,
    orden: 1,
    subtipos: [
      { codigo: "1.1.1", nombre: "1.1.1 Gas — Instalación Nueva (SEC Obligatorio)" },
      { codigo: "1.1.2", nombre: "1.1.2 Gas — Modificación de Red Existente" },
      { codigo: "1.1.3", nombre: "1.1.3 Gas — Ampliación de Trazado" },
      { codigo: "1.1.4", nombre: "1.1.4 Gas — Gabinete de Medidores" },
      { codigo: "1.1.5", nombre: "1.1.5 Gas — Prueba de Hermeticidad Manométrica" },
      { codigo: "1.1.6", nombre: "1.1.6 Gas — Trámite Sello Verde / SEC" },
    ],
  },
  {
    codigo: "CALEFACCION",
    nombre: "Calefacción & Clima",
    descripcion: "Radiadores de agua caliente, piso radiante y sistemas HVAC.",
    icono: "Thermometer",
    color: "blue",
    requiereVisita: true,
    orden: 2,
    subtipos: [
      { codigo: "1.2.1", nombre: "1.2.1 Calefacción — Red Central (Matrices)" },
      { codigo: "1.2.2", nombre: "1.2.2 Calefacción — Radiadores (PPR/PEX)" },
      { codigo: "1.2.3", nombre: "1.2.3 Calefacción — Piso Radiante (por m²)" },
      { codigo: "1.2.4", nombre: "1.2.4 Climatización — Sistema HVAC" },
    ],
  },
  {
    codigo: "PLOMERIA",
    nombre: "Plomería & Sanitaria",
    descripcion: "Redes de agua potable, desagües y conexiones hidráulicas.",
    icono: "Droplets",
    color: "cyan",
    requiereVisita: true,
    orden: 3,
    subtipos: [
      { codigo: "1.3.1", nombre: "1.3.1 Plomería — Red de Agua Potable Fría/Caliente" },
      { codigo: "1.3.2", nombre: "1.3.2 Plomería — Puntos Sanitarios y Desagües" },
      { codigo: "1.3.3", nombre: "1.3.3 Plomería — Reparación / Modificación de Cañerías" },
    ],
  },
  {
    codigo: "EQUIPOS",
    nombre: "Equipos & Calderas",
    descripcion: "Montaje de caldera/calefón nuevo, mantención periódica o reparación.",
    icono: "Wrench",
    color: "purple",
    requiereVisita: false,
    orden: 4,
    subtipos: [
      { codigo: "3.2", nombre: "3.2 Equipo Nuevo (Provisión + Montaje)" },
      { codigo: "3.3", nombre: "3.3 Revisión Técnica y Diagnóstico de Fallas" },
      { codigo: "3.4", nombre: "3.4 Mantenimiento Preventivo / Correctivo" },
      { codigo: "3.5", nombre: "3.5 Remplazo de Equipo Existente" },
      { codigo: "3.6", nombre: "3.6 Reglaje y Calibración de Combustión" },
    ],
  },
  {
    codigo: "OTROS",
    nombre: "Otros Servicios & Trámites",
    descripcion: "Pruebas de hermeticidad manométrica, cambio de medidor, alquiler de herramientas o servicios especiales.",
    icono: "ClipboardCheck",
    color: "amber",
    requiereVisita: true,
    orden: 5,
    subtipos: [
      { codigo: "OTR.1", nombre: "OTR.1 Otros: Prueba de Hermeticidad Manométrica" },
      { codigo: "OTR.2", nombre: "OTR.2 Otros: Cambio / Reemplazo de Medidor de Gas" },
      { codigo: "OTR.3", nombre: "OTR.3 Otros: Alquiler de Herramientas Especiales (por día)" },
      { codigo: "OTR.4", nombre: "OTR.4 Otros: Solicitud de Devolución / Reembolso" },
    ],
  },
  {
    codigo: "TIENDA",
    nombre: "Venta Tienda / Insumos",
    descripcion: "Venta directa de cañerías, fittings, válvulas o repuestos en mostrador.",
    icono: "ShoppingBag",
    color: "emerald",
    requiereVisita: false,
    orden: 6,
    subtipos: [
      { codigo: "2.1.1", nombre: "2.1.1 Venta de Fittings y Accesorios" },
      { codigo: "2.1.2", nombre: "2.1.2 Venta de Repuestos de Calderas" },
      { codigo: "2.1.3", nombre: "2.1.3 Venta de Tuberías Cobre / PPR / PEX" },
    ],
  },
];

export async function GET() {
  try {
    let categorias = await prisma.catalogoCategoria.findMany({
      where: { activo: true },
      orderBy: { orden: "asc" },
      include: {
        subtipos: {
          where: { activo: true },
          orderBy: { orden: "asc" },
        },
      },
    });

    // Si está vacío, poblar catálogo inicial
    if (categorias.length === 0) {
      for (const cat of CATALOGO_INICIAL) {
        const { subtipos, ...catData } = cat;
        const createdCat = await prisma.catalogoCategoria.create({
          data: catData,
        });

        for (let i = 0; i < subtipos.length; i++) {
          await prisma.catalogoSubtipo.create({
            data: {
              categoriaId: createdCat.id,
              codigo: subtipos[i].codigo,
              nombre: subtipos[i].nombre,
              orden: i + 1,
            },
          });
        }
      }

      categorias = await prisma.catalogoCategoria.findMany({
        where: { activo: true },
        orderBy: { orden: "asc" },
        include: {
          subtipos: {
            where: { activo: true },
            orderBy: { orden: "asc" },
          },
        },
      });
    }

    return NextResponse.json(categorias);
  } catch (error) {
    console.error("Error al obtener catálogo:", error);
    return NextResponse.json({ error: "Error al cargar catálogo" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("servigaz_token")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.rol !== "ADMIN") {
      return NextResponse.json(
        { error: "Solo el Gerente / Administrador puede modificar el catálogo." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { accion, data } = body;

    // EDITAR CATEGORIA (Nombre, Descripción, Requiere Visita)
    if (accion === "EDITAR_CATEGORIA") {
      const { id, nombre, descripcion, requiereVisita } = data;
      const updated = await prisma.catalogoCategoria.update({
        where: { id },
        data: {
          nombre,
          descripcion,
          requiereVisita: Boolean(requiereVisita),
        },
      });

      await prisma.auditoriaLog.create({
        data: {
          usuarioId: decoded.id,
          modulo: "CATALOGO_SERVICIOS",
          accion: "UPDATE",
          entidadTipo: "CatalogoCategoria",
          entidadId: id,
          valoresNuevos: { nombre, descripcion },
        },
      });

      return NextResponse.json({ success: true, categoria: updated });
    }

    // CREAR CATEGORIA
    if (accion === "CREAR_CATEGORIA") {
      const { codigo, nombre, descripcion, icono, color, requiereVisita } = data;
      const count = await prisma.catalogoCategoria.count();
      const created = await prisma.catalogoCategoria.create({
        data: {
          codigo: codigo.toUpperCase().replace(/\s+/g, "_"),
          nombre,
          descripcion,
          icono: icono || "Wrench",
          color: color || "blue",
          requiereVisita: Boolean(requiereVisita),
          orden: count + 1,
        },
      });

      return NextResponse.json({ success: true, categoria: created });
    }

    // AGREGAR SUBTIPO
    if (accion === "CREAR_SUBTIPO") {
      const { categoriaId, codigo, nombre, descripcion } = data;
      const count = await prisma.catalogoSubtipo.count({ where: { categoriaId } });
      const created = await prisma.catalogoSubtipo.create({
        data: {
          categoriaId,
          codigo,
          nombre,
          descripcion,
          orden: count + 1,
        },
      });

      await prisma.auditoriaLog.create({
        data: {
          usuarioId: decoded.id,
          modulo: "CATALOGO_SERVICIOS",
          accion: "CREATE",
          entidadTipo: "CatalogoSubtipo",
          entidadId: created.id,
          valoresNuevos: { codigo, nombre },
        },
      });

      return NextResponse.json({ success: true, subtipo: created });
    }

    // EDITAR SUBTIPO
    if (accion === "EDITAR_SUBTIPO") {
      const { id, codigo, nombre, descripcion } = data;
      const updated = await prisma.catalogoSubtipo.update({
        where: { id },
        data: {
          codigo,
          nombre,
          descripcion,
        },
      });

      await prisma.auditoriaLog.create({
        data: {
          usuarioId: decoded.id,
          modulo: "CATALOGO_SERVICIOS",
          accion: "UPDATE",
          entidadTipo: "CatalogoSubtipo",
          entidadId: id,
          valoresNuevos: { codigo, nombre },
        },
      });

      return NextResponse.json({ success: true, subtipo: updated });
    }

    // ELIMINAR / DESACTIVAR SUBTIPO
    if (accion === "ELIMINAR_SUBTIPO") {
      const { id } = data;
      await prisma.catalogoSubtipo.update({
        where: { id },
        data: { activo: false },
      });

      await prisma.auditoriaLog.create({
        data: {
          usuarioId: decoded.id,
          modulo: "CATALOGO_SERVICIOS",
          accion: "DELETE",
          entidadTipo: "CatalogoSubtipo",
          entidadId: id,
        },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (error: any) {
    console.error("Error modificando catálogo:", error);
    return NextResponse.json({ error: "Error al actualizar catálogo" }, { status: 500 });
  }
}

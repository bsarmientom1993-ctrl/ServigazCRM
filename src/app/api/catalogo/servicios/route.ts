import { configureExampleCatalog } from "@/lib/catalog-examples.cjs";
import { requireSession } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/api";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req);
    const categorias = await prisma.catalogoCategoria.findMany({
      where: { activo: true },
      orderBy: { orden: "asc" },
      include: {
        subtipos: {
          where: { activo: true },
          orderBy: { orden: "asc" },
        },
      },
    });

    return NextResponse.json(categorias);
  } catch (error: any) {
    if (error instanceof ApiError) return apiError(error);
    console.error("Error al obtener catálogo:", error);
    return NextResponse.json({ error: "Error al cargar catálogo" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req, ["ADMIN"]);
    const decoded = session;

    const body = await req.json();
    const { accion, data } = body;

    if (accion === "CARGAR_EJEMPLOS") {
      const resumen = await configureExampleCatalog(prisma, { userId: session.id });
      return NextResponse.json({ success: true, resumen });
    }

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
    if (error instanceof ApiError) return apiError(error);
    console.error("Error modificando catálogo:", error);
    return NextResponse.json({ error: "Error al actualizar catálogo" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "servigaz-secret-key-2026";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const estado = searchParams.get("estado");
    const tecnicoId = searchParams.get("tecnicoId");

    const where: any = {};
    if (estado) where.estado = estado;
    if (tecnicoId) where.tecnicoId = tecnicoId;

    const trabajos = await prisma.trabajo.findMany({
      where,
      include: {
        cliente: true,
        tecnico: { select: { id: true, nombre: true, email: true, telefono: true } },
        encargado: { select: { id: true, nombre: true, email: true } },
        cotizaciones: { orderBy: { numeroVersion: "desc" }, take: 1 },
        visitas: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(trabajos);
  } catch (error: any) {
    console.error("Error al listar trabajos:", error);
    return NextResponse.json({ error: "Error al listar trabajos: " + error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let {
      clienteId,
      nuevoCliente,
      tipoFlujo,
      subtipoCodigo,
      subtipoNombre,
      observaciones,
      dificultadNivel,
      tecnicoId,
      fechaProgramada,
      requiereVisitaLevantamiento,
      precioDirectoSugerido,
    } = body;

    // 1. Si se solicita registrar un nuevo cliente al vuelo
    if (!clienteId && nuevoCliente) {
      const clienteCreado = await prisma.cliente.create({
        data: {
          nombreCompleto: nuevoCliente.nombreCompleto,
          telefonos: [nuevoCliente.telefono || "+591 70000000"],
          email: nuevoCliente.email || null,
          direccion: nuevoCliente.direccion,
          nivelFidelizacion: "NUEVO",
        },
      });
      clienteId = clienteCreado.id;
    }

    if (!clienteId) {
      return NextResponse.json({ error: "Debe seleccionar o registrar un cliente." }, { status: 400 });
    }

    const count = await prisma.trabajo.count();
    const correlativo = `TRB-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    // Obtener encargado por defecto o admin
    const encargado = await prisma.usuario.findFirst({
      where: { rol: { in: ["ENCARGADO", "ADMIN"] } },
    });

    // Determinar si es Servicio Directo (ej: revisión de calefón, mantenimiento) o Instalación con Levantamiento
    const esServicioDirecto =
      requiereVisitaLevantamiento === false ||
      subtipoCodigo?.includes("3.3") ||
      subtipoCodigo?.includes("3.4") ||
      subtipoCodigo?.includes("3.6") ||
      subtipoCodigo?.includes("OTR") ||
      subtipoCodigo?.includes("TIENDA") ||
      tipoFlujo === "SIMPLIFICADO";

    // Si es servicio directo, el estado inicial salta directamente a COTIZADO
    const estadoInicial = esServicioDirecto
      ? "COTIZADO"
      : tecnicoId && fechaProgramada
      ? "EVALUACION_PENDIENTE"
      : "BORRADOR";

    const nuevoTrabajo = await prisma.trabajo.create({
      data: {
        codigoCorrelativo: correlativo,
        clienteId,
        encargadoId: encargado?.id || "",
        tecnicoId: tecnicoId || null,
        tipoFlujo: esServicioDirecto ? "SIMPLIFICADO" : tipoFlujo || "COMPLETO",
        subtipoCodigo: subtipoCodigo || "GENERAL",
        subtipoNombre: subtipoNombre || "Servicio General",
        observaciones: observaciones || (esServicioDirecto ? "Atención directa de servicio técnico" : undefined),
        dificultadNivel: Number(dificultadNivel || 1),
        requiereInstaladorExtra: Number(dificultadNivel) >= 4,
        estado: estadoInicial,
      },
    });

    // 2. Si es Servicio Directo, emitir cotización formal fija inmediata
    if (esServicioDirecto) {
      let tarifaFija = Number(precioDirectoSugerido || 0);

      if (!tarifaFija) {
        // Buscar tarifa en BD según subtipo
        const mo = await prisma.configuracionManoObra.findFirst({
          where: { subtipoCodigo: { in: [subtipoCodigo, "3.3", "3.4", "3.6", "OTROS"] } },
        });
        tarifaFija = mo ? mo.tarifaBase : 180; // Bs. 180 por defecto para revisión
      }

      const fechaVencimiento = new Date();
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 15);

      await prisma.cotizacion.create({
        data: {
          trabajoId: nuevoTrabajo.id,
          numeroVersion: 1,
          tipoVersion: "ORIGINAL",
          subtotalMateriales: 0,
          subtotalManoObra: tarifaFija,
          montoTransporte: 0,
          totalCotizado: tarifaFija,
          anticipoMinimoRequerido: tarifaFija, // En servicios puntuales el anticipo o pago es 100%
          fechaVencimiento,
          estado: "VIGENTE",
          datosFormularioJson: {
            tipoServicio: "DIRECTO_SIN_LEVANTAMIENTO",
            concepto: subtipoNombre,
            tarifaFija,
          },
          snapshotCalculoJson: {
            concepto: subtipoNombre,
            tarifaBase: tarifaFija,
            total: tarifaFija,
          },
        },
      });
    }

    // 3. Crear Visita si viene programada
    if (tecnicoId && fechaProgramada) {
      await prisma.visitaTecnica.create({
        data: {
          trabajoId: nuevoTrabajo.id,
          tecnicoId,
          fechaProgramada: new Date(fechaProgramada),
          observaciones: esServicioDirecto
            ? "Visita para ejecución directa del servicio (no requiere medición de metros)"
            : "Visita técnica de medición y levantamiento en terreno",
          completada: false,
        },
      });
    }

    // Registrar en auditoría
    await prisma.auditoriaLog.create({
      data: {
        usuarioId: encargado?.id || null,
        modulo: "TRABAJOS",
        accion: "CREATE",
        entidadTipo: "Trabajo",
        entidadId: nuevoTrabajo.id,
        valoresNuevos: {
          codigo: correlativo,
          clienteId,
          subtipoCodigo,
          esServicioDirecto,
          estado: estadoInicial,
        },
      },
    });

    return NextResponse.json(nuevoTrabajo, { status: 201 });
  } catch (error: any) {
    console.error("Error al crear trabajo:", error);
    return NextResponse.json({ error: "Error al crear trabajo: " + error.message }, { status: 500 });
  }
}

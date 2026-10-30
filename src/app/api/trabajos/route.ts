import { activeTeamMember } from "@/lib/work-responsibility";
import { receptionSchema } from '@/lib/reception';
import { rolesOf } from '@/lib/user-roles';
import {queueWorkNotice} from '@/lib/notifications';
import { Prisma } from "@prisma/client";
import { technicalWorkSelect, technicalSchedule } from "@/lib/technical-work";
import { newGasProject } from "@/lib/gas-data";
import { createHash } from "node:crypto";
import { newCustomerSchema } from "@/lib/work-wizard";
import { assertTechnicianSlot, schedulingSchema } from "@/lib/scheduling";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireSession, managers, workScope,assignedRoleWhere } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const user = await requireSession(req);
    const estado = req.nextUrl.searchParams.get("estado");
    const tecnicoId = req.nextUrl.searchParams.get("tecnicoId");
    const where: Prisma.TrabajoWhereInput = { AND: [workScope(user), ...(estado ? [{ estado: z.enum(["BORRADOR", "EVALUACION_PENDIENTE", "EVALUADO", "COTIZADO", "COTIZACION_VENCIDA", "EN_NEGOCIACION", "APROBADO", "PAGO_A_CUENTA_RECIBIDO", "PAGO_A_CUENTA_VENCIDO", "RECHAZADO", "ANTICIPO_RECIBIDO", "EN_PROCESO", "EN_PAUSA", "CANCELADO", "TERMINADO_TECNICO", "VALIDADO", "FINALIZADO_FINANCIERO", "ARCHIVADO", "RECLAMO_GARANTIA"]).parse(estado) }] : []), ...(tecnicoId ? [{ tecnicoId }] : [])] };
    if (user.rol === "TECNICO_FIJO") {
      const trabajos = await prisma.trabajo.findMany({ where, select: technicalWorkSelect, orderBy: { createdAt: "desc" } });
      return NextResponse.json(trabajos.map(work => ({ ...work, fechasSla: technicalSchedule(work.fechasSla) })));
    }
    const trabajos = await prisma.trabajo.findMany({
      where,
      include: { cliente: true, tecnico: { select: { id: true, nombre: true, email: true, telefono: true } },
        encargado: { select: { id: true, nombre: true, email: true } },
        cotizaciones: { orderBy: { numeroVersion: "desc" }, take: 1 },
        visitas: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(trabajos);
  } catch (error) { return apiError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req, ["ADMIN","ENCARGADO","VENTAS"]);
    const requestId = z.string().uuid("Clave de solicitud inválida.").optional().parse(req.headers.get("Idempotency-Key") || undefined);
    const body = z.object({
      sucursalId:z.string().min(1).max(100).optional(), recepcion:receptionSchema.optional(),
      pedidoProfesionalId:z.string().uuid().optional(),
      modalidad: z.enum(["SERVICIO", "PROYECTO_INDEPENDIENTE"]).default("SERVICIO"),
      captadoPorId: z.string().trim().min(1).max(100).nullish(), responsableSeguimientoId: z.string().trim().min(1).max(100).nullish(),
      clienteId: z.string().min(1).nullish(),
      nuevoCliente: newCustomerSchema.nullish(),
      tipoFlujo: z.enum(["COMPLETO", "SIMPLIFICADO"]).default("COMPLETO"),
      subtipoCodigo: z.string().trim().min(1).max(300), subtipoNombre: z.string().trim().min(1).max(500),
      subtipoCodigos: z.array(z.string().trim().min(1).max(100)).min(1).max(20).optional(),
      detallesCliente: z.string().trim().max(2000).optional(),
      preferenciaCliente: z.object({ fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")), desde: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), hasta: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/) }).nullish(),
      agenda: schedulingSchema.optional(),
      incluyeProyectoGas: z.boolean().default(false),
      observaciones: z.string().trim().max(3000).optional(),
      dificultadNivel: z.number().int().min(1).max(5).default(1),
      tecnicoId: z.string().min(1).nullish(), fechaProgramada: z.string().datetime({ offset: true, message: "Selecciona una fecha válida con zona horaria." }).nullish(),
    }).parse(await req.json());
    if(body.sucursalId&&session.rol!=='ADMIN'&&body.sucursalId!==session.sucursalId)throw new ApiError(403,'Solo puedes recibir clientes en tu sucursal.');
    const user={...session,sucursalId:body.sucursalId||session.sucursalId};
    if(body.recepcion&&!user.sucursalId)throw new ApiError(400,'Selecciona la sucursal de recepción.');
    if(body.recepcion?.equipo&&(body.recepcion.motivo!=='REVISION'||body.tecnicoId||body.fechaProgramada))throw new ApiError(400,'La recepción física del equipo corresponde a una revisión en sucursal, sin visita a domicilio.');
    if(body.recepcion?.proximoContacto&&new Date(body.recepcion.proximoContacto)<=new Date())throw new ApiError(400,'La próxima fecha de contacto debe ser futura.');
    if (!body.clienteId && !body.nuevoCliente) throw new ApiError(400, "Selecciona o registra un cliente.");
    if (Boolean(body.tecnicoId) !== Boolean(body.fechaProgramada)) throw new ApiError(400, "Para programar indica técnico y fecha.");
    if (body.fechaProgramada && !Number.isFinite(new Date(body.fechaProgramada).getTime())) throw new ApiError(400, "Fecha inválida.");
    if (body.preferenciaCliente && body.preferenciaCliente.desde >= body.preferenciaCliente.hasta) throw new ApiError(400, "Revisa el intervalo de preferencia del cliente.");
    const independent = body.modalidad === "PROYECTO_INDEPENDIENTE";
    if (independent && (body.tecnicoId || body.fechaProgramada)) throw new ApiError(400, "El proyecto independiente no requiere agendar una instalación.");
    if (independent && !body.captadoPorId) throw new ApiError(400, "Indica quién consiguió o consolidó el proyecto.");
    const fingerprint = createHash("sha256").update(user.id + JSON.stringify(body)).digest("hex");
    const work = await prisma.$transaction(async tx => {
      // Protect the annual sequence without a schema change.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(742381)`;
      if (requestId) {
        const previous = await tx.trabajo.findUnique({ where: { id: requestId } });
        if (previous) {
          const audit = await tx.auditoriaLog.findFirst({ where: { entidadId: requestId, entidadTipo: "Trabajo", accion: "CREATE", usuarioId: user.id }, orderBy: { timestamp: "asc" } });
          if (!body.recepcion&&user.rol!=='VENTAS'&&previous.encargadoId !== user.id || (audit?.valoresNuevos as any)?.requestFingerprint !== fingerprint) throw new ApiError(409, "Esta clave ya se utilizó para otra solicitud. Revisa el trabajo creado antes de volver a guardar.");
          return previous;
        }
      }
      const branch=body.recepcion?await tx.sucursal.findFirst({where:{id:user.sucursalId!,activo:true},select:{nombre:true}}):null;
      let professionalOrder=null;
      if(body.pedidoProfesionalId){await tx.$queryRaw`SELECT id FROM "PedidoProfesional" WHERE id=${body.pedidoProfesionalId} FOR UPDATE`;professionalOrder=await tx.pedidoProfesional.findUnique({where:{id:body.pedidoProfesionalId}});if(!professionalOrder)throw new ApiError(404,'Pedido profesional no encontrado.');const account=await tx.cuentaProfesional.findUniqueOrThrow({where:{id:professionalOrder.cuentaId}});if(account.estado!=='APROBADA'||body.clienteId!==account.clienteId||user.sucursalId!==account.sucursalId)throw new ApiError(403,'Revisa la cuenta, el cliente y la sucursal del pedido profesional.');if(professionalOrder.trabajoId||professionalOrder.estado==='RECHAZADO')throw new ApiError(409,'Este pedido ya fue vinculado o rechazado.');if(!body.captadoPorId)throw new ApiError(400,'Identifica a la persona que consiguió o consolidó la venta.');}
      if(body.recepcion&&!branch)throw new ApiError(400,'Selecciona una sucursal activa.');
      const codes = independent ? ["PROYECTO.GAS"] : body.subtipoCodigos || body.subtipoCodigo.split("_");
      if(professionalOrder&&(independent||codes.join('_')!==(professionalOrder.tipo==='PRODUCTOS'?'EQUIPO.PROVISION':professionalOrder.subtipoCodigo)))throw new ApiError(400,'El servicio debe corresponder al pedido profesional original.');
      if (new Set(codes).size !== codes.length || codes.join("_").length > 300) throw new ApiError(400, "Revisa los servicios seleccionados.");
      const subtypes = independent ? [{nombre:"Proyecto de gas independiente",categoria:{codigo:"GAS",activo:true,requiereVisita:false}}] : await tx.catalogoSubtipo.findMany({ where: { codigo: { in: codes }, activo: true }, include: { categoria: true } });
      if (subtypes.length !== codes.length || subtypes.some(s => !s.categoria.activo)) throw new ApiError(400, "Selecciona servicios activos del catálogo.");
      const originId=body.captadoPorId||(user.rol==='VENTAS'?user.id:null);
      const origin = originId ? await activeTeamMember(tx,user,originId,user.sucursalId) : null;
      let coordinator=user.rol==='VENTAS'?await tx.usuario.findFirst({where:{estado:'ACTIVO',sucursalId:user.sucursalId,...assignedRoleWhere('ENCARGADO')},select:{id:true}})||await tx.usuario.findFirst({where:{estado:'ACTIVO',...assignedRoleWhere('ADMIN')},select:{id:true}}):null;
      if(body.recepcion?.coordinadorId){const chosen=await tx.usuario.findUnique({where:{id:body.recepcion.coordinadorId}});if(!chosen||chosen.estado!=='ACTIVO'||!rolesOf(chosen).some(r=>r==='ADMIN'||r==='ENCARGADO')||chosen.sucursalId!==user.sucursalId&&!rolesOf(chosen).includes('ADMIN'))throw new ApiError(403,'Selecciona un encargado de esta sucursal o un administrador.');coordinator={id:chosen.id};}
      if(user.rol==='VENTAS'&&!coordinator)throw new ApiError(409,'Configura un encargado o administrador activo para coordinar esta solicitud.');
      const responsible = body.responsableSeguimientoId ? await activeTeamMember(tx,user,body.responsableSeguimientoId,user.sucursalId) : null;
      const hasGas = subtypes.some(s => s.categoria.codigo === "GAS");
      if (body.incluyeProyectoGas && !hasGas) throw new ApiError(400, "El proyecto de gas requiere un servicio de gas.");
      if (body.responsableSeguimientoId && (!hasGas || !independent && !body.incluyeProyectoGas)) throw new ApiError(400,"El seguimiento se asigna a una solicitud que incluya proyecto.");
      const direct = independent || subtypes.every(s => !s.categoria.requiereVisita);
      if(body.recepcion){const need=body.recepcion.motivo;const expected=need==='VENTA'?'PROVISION':need==='VENTA_INSTALACION'?'PROVISION_INSTALACION':null;if(expected&&subtypes.some(s=>s.categoria.codigo!==expected))throw new ApiError(400,'El servicio no corresponde al motivo de recepción.');if((need==='PROYECTO')!==independent)throw new ApiError(400,'Revisa la modalidad del proyecto.');if(need==='REVISION'&&subtypes.some(s=>!['MANTENIMIENTO','OTROS'].includes(s.categoria.codigo)))throw new ApiError(400,'Selecciona un servicio de revisión o mantenimiento.');}
      if (body.tipoFlujo === "SIMPLIFICADO" && !direct) throw new ApiError(400, "El servicio requiere evaluación previa.");
      const agenda = schedulingSchema.parse(body.agenda || {});
      if (body.tecnicoId && body.fechaProgramada) await assertTechnicianSlot(tx, user, body.tecnicoId, new Date(body.fechaProgramada), agenda);
      let clientId = body.clienteId;
      if (clientId) {
        const client = await tx.cliente.findUnique({ where: { id: clientId } });
        if (!client || ((user.rol !== "ADMIN" || body.recepcion) && client.sucursalId !== user.sucursalId)) throw new ApiError(403, "Cliente fuera de tu sucursal.");
      } else {
        const data = body.nuevoCliente!;
        if(body.recepcion){const phone=(s:string)=>s.replace(/\D/g,'').replace(/^591(?=\d{8}$)/,'');const existing=await tx.cliente.findMany({where:{sucursalId:user.sucursalId},select:{telefonos:true}});if(existing.some(c=>Array.isArray(c.telefonos)&&c.telefonos.some(p=>typeof p==='string'&&phone(p)===phone(data.telefono))))throw new ApiError(409,'Ya existe un cliente con ese teléfono en esta sucursal. Búscalo y utiliza su registro.');}
        const client = await tx.cliente.create({ data: { nombreCompleto: data.nombreCompleto, telefonos: [data.telefono], direccion: data.direccion, email: data.email, sucursalId: user.sucursalId } });
        clientId = client.id;
      }
      const prefix = "TRB-" + new Date().getFullYear() + "-";
      const receptionActor=body.recepcion?await tx.usuario.findUniqueOrThrow({where:{id:user.id},select:{nombre:true}}):null;
      const contact=body.recepcion?.responsableContactoId?await activeTeamMember(tx,user,body.recepcion.responsableContactoId,user.sucursalId):body.recepcion?{id:user.id,nombre:receptionActor!.nombre}:null;
      const previous = await tx.trabajo.findMany({ where: { codigoCorrelativo: { startsWith: prefix } }, select: { codigoCorrelativo: true } });
      const sequence = previous.reduce((max, w) => Math.max(max, Number(w.codigoCorrelativo.slice(prefix.length)) || 0), 0) + 1;
      const trabajo = await tx.trabajo.create({ data: {
        ...(requestId ? { id: requestId } : {}), codigoCorrelativo: prefix + String(sequence).padStart(4, "0"), clienteId: clientId!, encargadoId: coordinator?.id||user.id, sucursalId: user.sucursalId,
        tecnicoId: body.tecnicoId || null, tipoFlujo: direct ? "SIMPLIFICADO" : "COMPLETO", subtipoCodigo: codes.join("_"),
        subtipoNombre: subtypes.map(s => s.nombre).join(" + "), observaciones: [body.detallesCliente ? "Detalles del cliente: " + body.detallesCliente : "", body.observaciones || ""].filter(Boolean).join("\n\n"),
        fechasSla: { modalidad: body.modalidad, captadoPor: origin, ...(professionalOrder?{pedidoProfesional:{id:professionalOrder.id,cuentaId:professionalOrder.cuentaId,tipo:professionalOrder.tipo,total:professionalOrder.total?String(professionalOrder.total):null,items:professionalOrder.items,descuentoPct:String(professionalOrder.descuentoPct)}}:{}), ...(body.recepcion?{recepcion:{motivo:body.recepcion.motivo,atendidoPorId:user.id,atendidoPorNombre:receptionActor!.nombre,sucursalNombre:branch!.nombre,fecha:new Date().toISOString(),seguimiento:{responsableId:contact!.id,responsableNombre:contact!.nombre,proximoContacto:body.recepcion.proximoContacto||'',nota:'',actualizado:new Date().toISOString()}}}:{}), ...(body.preferenciaCliente ? { preferenciaCliente: body.preferenciaCliente } : {}), ...(hasGas ? { gas: JSON.parse(JSON.stringify({ aplica: true, proyecto: {...newGasProject(independent || body.incluyeProyectoGas), ...(responsible ? {responsableId:responsible.id,responsable:responsible.nombre} : {})} })) } : {}) },
        dificultadNivel: body.dificultadNivel, requiereInstaladorExtra: body.dificultadNivel >= 4,
        estado: direct ? "EVALUADO" : body.tecnicoId ? "EVALUACION_PENDIENTE" : "BORRADOR",
      } });
      if(body.recepcion?.equipo){const customer=await tx.cliente.findUniqueOrThrow({where:{id:clientId!},select:{nombreCompleto:true}});const equipment=await tx.recepcionEquipo.create({data:{...body.recepcion.equipo,trabajoId:trabajo.id,codigo:'REC-'+trabajo.codigoCorrelativo,clienteNombre:customer.nombreCompleto,sucursalNombre:branch!.nombre,recibidoPorId:user.id,recibidoPorNombre:receptionActor!.nombre}});await tx.auditoriaLog.create({data:{usuarioId:user.id,modulo:'RECEPCION_EQUIPOS',accion:'CREATE',entidadTipo:'RecepcionEquipo',entidadId:equipment.id,valoresNuevos:{trabajoId:trabajo.id,codigo:equipment.codigo,realizadoPor:receptionActor!.nombre}}});}
      // Direct services go straight to an explicit, reviewed quote; never invent a tariff.
      if (body.tecnicoId && body.fechaProgramada) await tx.visitaTecnica.create({ data: {
        trabajoId: trabajo.id, tecnicoId: body.tecnicoId, fechaProgramada: new Date(body.fechaProgramada),
        observaciones: direct ? "Atención directa del servicio" : "Visita de evaluación", condicionesJson: { agenda },
      } });
      const actor = await tx.usuario.findUniqueOrThrow({ where: { id: user.id }, select: { nombre: true } });
      await tx.auditoriaLog.create({ data: { usuarioId: user.id, modulo: "TRABAJOS", accion: "CREATE", entidadTipo: "Trabajo", entidadId: trabajo.id,
        valoresNuevos: { realizadoPor: actor.nombre, captadoPor: origin, modalidad: body.modalidad, codigo: trabajo.codigoCorrelativo, estado: trabajo.estado, servicioDirecto: direct, ...(requestId ? { requestFingerprint: fingerprint } : {}) } } });
      if(professionalOrder)await tx.pedidoProfesional.update({where:{id:professionalOrder.id},data:{trabajoId:trabajo.id,estado:'EN_ATENCION'}});
      await queueWorkNotice(tx,trabajo,user.id);
      return trabajo;
    }, { timeout: 15000 });
    return NextResponse.json(work, { status: 201 });
  } catch (error) { return apiError(error); }
}

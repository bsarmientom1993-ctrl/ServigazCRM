import { isIndependentProject } from "@/lib/work-responsibility";
import { gasData } from "@/lib/gas-data";
import { evidencePhoto, assertPhotoReferences } from "@/lib/work-photos";
import { lockLocations, locationForOperation, lockProduct, takeStock } from "@/lib/inventory";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireSession, managers } from "@/lib/auth";
import { ApiError, apiError } from "@/lib/api";
import { withWork } from "@/lib/workflow";
import { cents, assertStart } from "@/lib/workflow-policy";

const evidence = z.array(evidencePhoto).min(2, "Adjunta al menos dos fotos del resultado final.").max(20).refine(values => new Set(values).size === values.length, "Usa fotografías distintas.");
const materialSchema = z.object({
  descripcion: z.string().trim().min(1).max(500),
  cantidad: z.number().finite().positive().max(99999999.99),
  costoUnitario: z.number().finite().nonnegative(),
  esDeInventario: z.boolean(),
  productoId: z.string().optional(),
  ubicacionId: z.string().optional(),
  proveedorNombre: z.string().trim().max(300).optional(),
  proveedorContacto: z.string().trim().max(300).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(req);
    const { id } = await params;
    const body = z.object({ accion: z.enum(["INICIAR_EJECUCION", "REGISTRAR_MATERIAL", "FINALIZAR_TECNICO", "VALIDAR_ENCARGADO"]), data: z.unknown().optional() }).parse(await req.json());
    if (body.accion === "VALIDAR_ENCARGADO" && !managers.includes(user.rol)) throw new ApiError(403, "La calidad debe aprobarla el encargado.");
    const result = await withWork(id, user, async (tx, actor) => {
      const work = await tx.trabajo.findUniqueOrThrow({ where: { id }, include: {
        cotizaciones: { orderBy: { numeroVersion: "desc" }, take: 1 }, pagos: true, egreso: true,
      } });
      if (work.egreso) throw new ApiError(409, "El trabajo ya tiene cierre financiero.");
      const independent=isIndependentProject(work);
      if(independent && body.accion!=="VALIDAR_ENCARGADO") throw new ApiError(409,"Este proyecto se gestiona desde su expediente y no tiene ejecución de instalación.");
      let changes: Prisma.TrabajoUpdateInput = {};
      let details: Prisma.InputJsonObject = { accion: body.accion };
      if (body.accion === "INICIAR_EJECUCION") {
        const quote = work.cotizaciones[0];
        if (!quote) throw new ApiError(409, "Falta la cotización aceptada.");
        assertStart(work.estado, Boolean(work.tecnicoId), quote.estado === "APROBADA", cents(quote.anticipoMinimoRequerido),
          work.pagos.reduce((sum, p) => sum + cents(p.monto), 0));
        const technician = await tx.usuario.findUnique({ where: { id: work.tecnicoId! } });
        if (!technician || technician.estado !== "ACTIVO" || technician.rol !== "TECNICO_FIJO") throw new ApiError(409, "Asigna un técnico activo.");
        changes = { estado: "EN_PROCESO", fechaInicioEjecucion: new Date() };
      } else if (body.accion === "REGISTRAR_MATERIAL") {
        if (work.estado !== "EN_PROCESO") throw new ApiError(409, "Registra materiales durante la ejecución.");
        const input = body.data && typeof body.data === "object" ? body.data as Record<string, unknown> : {};
        if (user.rol === "TECNICO_FIJO" && input.esDeInventario !== true) throw new ApiError(403, "Las compras externas las registra el encargado. Solicita el material necesario.");
        const data = materialSchema.parse(user.rol === "TECNICO_FIJO" ? { ...input, costoUnitario: 0 } : body.data);
        const quantity = new Prisma.Decimal(data.cantidad);
        if (quantity.decimalPlaces() > 2) throw new ApiError(400, "La cantidad admite hasta dos decimales.");
        let unitCost = new Prisma.Decimal(cents(data.costoUnitario)).div(100);
        if (data.esDeInventario) {
          if (!data.productoId) throw new ApiError(400, "Selecciona un producto.");
          if (!data.ubicacionId) throw new ApiError(400, "Selecciona el almacén o tienda de origen.");
          await lockLocations(tx, [data.ubicacionId]);
          const location = await locationForOperation(tx, user, data.ubicacionId);
          if (location.esInicial) throw new ApiError(409, "Distribuye primero el inventario previo.");
          if (user.rol !== "ADMIN" && work.sucursalId !== location.sucursalId) throw new ApiError(403, "El material debe salir de la sucursal de la orden.");
          const product = await lockProduct(tx, data.productoId);
          const balance = await takeStock(tx, product.id, location.id, quantity);
          await tx.productoInventario.update({ where: { id: product.id }, data: { stockActual: { decrement: quantity } } });
          unitCost = product.costoPromedio;
          await tx.movimientoInventario.create({ data: {
            productoId: product.id, tipoMovimiento: "CONSUMO_TRABAJO", cantidad: quantity,
            stockAnterior: balance.before, stockNuevo: balance.after, usuarioId: user.id,
            ubicacionOrigenId: location.id, origenSucursalId: location.sucursalId, evento: "CONSUMO",
            costoUnitario: unitCost, observaciones: "Consumo en trabajo " + work.codigoCorrelativo,
          } });
        }
        const material = await tx.materialEjecucion.create({ data: {
          trabajoId: id, tipoOrigen: data.esDeInventario ? "INVENTARIO" : "MANUAL_FUERA_INVENTARIO",
          productoId: data.esDeInventario ? data.productoId : null, descripcion: data.descripcion,
          cantidad: quantity, costoUnitario: unitCost, subtotalCosto: quantity.mul(unitCost).toDecimalPlaces(2),
          proveedorNombre: data.proveedorNombre || null, proveedorContacto: data.proveedorContacto || null, consumido: true,
        } });
        await tx.auditoriaLog.create({ data: {
          usuarioId: user.id, modulo: "EJECUCION", accion: "CREATE", entidadTipo: "MaterialEjecucion", entidadId: material.id,
          valoresNuevos: { realizadoPor: actor.nombre, trabajoId: id, cantidad: String(quantity), costoUnitario: String(unitCost), subtotal: String(material.subtotalCosto) },
        } });
        return user.rol === "TECNICO_FIJO" ? { success: true, material: { id: material.id, descripcion: material.descripcion, cantidad: material.cantidad } } : { success: true, material };
      } else if (body.accion === "FINALIZAR_TECNICO") {
        if (work.estado !== "EN_PROCESO") throw new ApiError(409, "Solo puede terminarse un trabajo en ejecución.");
        const issued=await tx.entregaMaterialItem.findMany({where:{entrega:{proforma:{trabajoId:id}}},select:{cantidad:true,consumida:true,devuelta:true}});
        if(issued.some(i=>i.cantidad.gt(i.consumida.add(i.devuelta))))throw new ApiError(409,"Registra el uso o devuelve los materiales entregados antes de terminar el trabajo técnico.");
        const data = z.object({ fotosTermino: evidence, observacionesTermino: z.string().trim().min(5, "Describe el resultado de las pruebas y el trabajo realizado.").max(3000) }).parse(body.data);
        await assertPhotoReferences(tx, data.fotosTermino, id, "FINAL");
        changes = { estado: "TERMINADO_TECNICO", fechaFinEjecucion: new Date(), porcentajeAvance: 100 };
        // Persist evidence with author and timestamp instead of discarding it.
        details = { ...details, fotosTermino: data.fotosTermino, observacionesTermino: data.observacionesTermino };
      } else {
        if(independent){
          if(gasData(work).proyecto?.estado!=="ENTREGADO" || work.cotizaciones[0]?.estado!=="APROBADA" || !["APROBADO","PAGO_A_CUENTA_RECIBIDO","ANTICIPO_RECIBIDO","VALIDADO"].includes(work.estado)) throw new ApiError(409,"Registra la entrega del proyecto y la aceptación de la cotización antes de validar.");
        } else if (work.estado !== "TERMINADO_TECNICO") throw new ApiError(409, "El técnico debe terminar el trabajo antes de validar calidad.");
        changes = { estado: "VALIDADO" };
      }
      const trabajo = await tx.trabajo.update({ where: { id }, data: changes });
      await tx.auditoriaLog.create({ data: {
        usuarioId: user.id, modulo: "EJECUCION", accion: "UPDATE", entidadTipo: "Trabajo", entidadId: id,
        valoresAnteriores: { estado: work.estado }, valoresNuevos: { realizadoPor: actor.nombre, ...details, estado: trabajo.estado },
      } });
      return user.rol === "TECNICO_FIJO" ? { success: true, trabajo: { id: trabajo.id, estado: trabajo.estado } } : { success: true, trabajo };
    });
    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}

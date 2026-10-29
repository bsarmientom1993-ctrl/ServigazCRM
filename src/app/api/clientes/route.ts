import { requireSession,workScope } from "@/lib/auth";
import {groupCustomerRecords,completedCustomerWorkStates} from '@/lib/customer-directory';
import { apiError, ApiError } from "@/lib/api";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req, ["ADMIN", "ENCARGADO", "VENTAS"]);
    if(req.nextUrl.searchParams.get('directorio')==='1'){
      const records=await prisma.cliente.findMany({where:session.rol==='ADMIN'?{}:{sucursalId:session.sucursalId},orderBy:[{createdAt:'asc'},{id:'asc'}]});
      const groups=groupCustomerRecords(records),historyId=req.nextUrl.searchParams.get('historial');
      const selected=historyId?groups.find(g=>g.registrosIds.includes(historyId)):null;
      if(historyId&&!selected)throw new ApiError(404,'Cliente no disponible en tu directorio.');
      const ids=selected?selected.registrosIds:records.map(c=>c.id);
      const works=await prisma.trabajo.findMany({where:{AND:[workScope(session),{clienteId:{in:ids}},...(historyId?[]:[{estado:{notIn:completedCustomerWorkStates as any}}])]},select:{id:true,clienteId:true,codigoCorrelativo:true,subtipoNombre:true,estado:true,createdAt:true},orderBy:[{createdAt:'desc'},{id:'desc'}]});
      if(historyId)return NextResponse.json({trabajos:works},{headers:{'Cache-Control':'private, no-store'}});
      return NextResponse.json(groups.map(g=>({...g,pendientes:works.filter(w=>g.registrosIds.includes(w.clienteId))})),{headers:{'Cache-Control':'private, no-store'}});
    }
    const clientes = await prisma.cliente.findMany({
      where: session.rol === "ADMIN" ? {} : { sucursalId: session.sucursalId },
      orderBy: { nombreCompleto: "asc" },
      include: {
        _count: { select: { trabajos: true } },
      },
    });
    return NextResponse.json(clientes);
  } catch (error: any) {
    if (error instanceof ApiError) return apiError(error);
    return NextResponse.json({ error: "Error al obtener clientes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req, ["ADMIN", "ENCARGADO", "VENTAS"]);
    const body = await req.json();
    const { nombreCompleto, telefono, email, direccion, ubicacionMapsUrl } = body;

    const cliente = await prisma.cliente.create({
      data: {
        nombreCompleto,
        telefonos: [telefono],
        email,
        direccion,
        ubicacionMapsUrl,
        nivelFidelizacion: "NUEVO",
        sucursalId: session.sucursalId,
      },
    });

    return NextResponse.json(cliente);
  } catch (error: any) {
    if (error instanceof ApiError) return apiError(error);
    return NextResponse.json({ error: "Error al crear cliente" }, { status: 500 });
  }
}

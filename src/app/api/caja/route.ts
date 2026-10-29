import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {requireSession,paymentOperators,workScope} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {withWork} from '@/lib/workflow';
import {apiError,ApiError} from '@/lib/api';
import {gasData} from '@/lib/gas-data';
import {cents} from '@/lib/workflow-policy';
export async function GET(req:NextRequest){try{
 const user=await requireSession(req,paymentOperators);const rows=await prisma.trabajo.findMany({where:workScope(user),select:{id:true,codigoCorrelativo:true,estado:true,subtipoNombre:true,cliente:{select:{nombreCompleto:true}},cotizaciones:{where:{estado:'APROBADA'},orderBy:{numeroVersion:'desc'},take:1,select:{totalCotizado:true,estado:true}},pagos:{select:{monto:true,fechaPago:true,metodoPago:true}},fechasSla:true},orderBy:{updatedAt:'desc'},take:300});
 const prepared=await prisma.auditoriaLog.findMany({where:{modulo:'CAJA',entidadId:{in:rows.map(w=>w.id)}},select:{entidadId:true,valoresNuevos:true},orderBy:{timestamp:'desc'}});
 return NextResponse.json({trabajos:rows.filter(w=>w.cotizaciones.length).map(({fechasSla,...w})=>{const total=cents(w.cotizaciones[0].totalCotizado),paid=w.pagos.reduce((s,p)=>s+cents(p.monto),0);const project=gasData({fechasSla}).proyecto;return {...w,total:total/100,pagado:paid/100,saldo:(total-paid)/100,proyectoPendiente:!!project?.incluido&&project.estado!=='ENTREGADO',preparado:prepared.some(a=>a.entidadId===w.id)};})});
}catch(e){return apiError(e);}}
export async function POST(req:NextRequest){try{
 const user=await requireSession(req,paymentOperators);const {trabajoId}=z.object({trabajoId:z.string().min(1)}).strict().parse(await req.json());
 const result=await withWork(trabajoId,user,async(tx,actor)=>{const w=await tx.trabajo.findUniqueOrThrow({where:{id:trabajoId},include:{pagos:true,cotizaciones:{where:{estado:'APROBADA'},orderBy:{numeroVersion:'desc'},take:1}}});
  if(w.estado!=='VALIDADO'||!w.cotizaciones[0]||cents(w.cotizaciones[0].totalCotizado)!==w.pagos.reduce((s,p)=>s+cents(p.monto),0))throw new ApiError(409,'Se requiere calidad validada y cobros conciliados para preparar el cierre.');
  const project=gasData(w).proyecto;if(project?.incluido&&project.estado!=='ENTREGADO')throw new ApiError(409,'El proyecto debe estar entregado.');
  const issued=await tx.entregaMaterialItem.findMany({where:{entrega:{proforma:{trabajoId}}}});if(issued.some(i=>i.cantidad.gt(i.consumida.add(i.devuelta))))throw new ApiError(409,'Concilia los materiales entregados.');
  if(!await tx.auditoriaLog.findFirst({where:{modulo:'CAJA',entidadId:trabajoId}}))await tx.auditoriaLog.create({data:{usuarioId:user.id,modulo:'CAJA',accion:'CREATE',entidadTipo:'Trabajo',entidadId:trabajoId,valoresNuevos:{accion:'CIERRE_PREPARADO',realizadoPor:actor.nombre}}});return {success:true};
 });return NextResponse.json(result);
}catch(e){return apiError(e);}}

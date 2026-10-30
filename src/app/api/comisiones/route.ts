import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {createHash} from 'node:crypto';
import {prisma} from '@/lib/prisma';
import {requireSession} from '@/lib/auth';
import {apiError,ApiError} from '@/lib/api';
import {cents} from '@/lib/workflow-policy';
import {queueNotice} from '@/lib/notifications';
const states=['PENDIENTE','APROBADA','PAGADA','ANULADA','NO_GENERADA'] as const;
function safeRow(row:any,admin:boolean){
 if(admin){const {pagoHuella,...safe}=row;return safe;}
 return {id:row.id,codigoTrabajo:row.codigoTrabajo,servicio:row.servicio,beneficiarioNombre:row.beneficiarioNombre,monto:row.monto,estado:row.estado,motivo:row.motivo,createdAt:row.createdAt,aprobadaAt:row.aprobadaAt,aprobadaPorNombre:row.aprobadaPorNombre,pagadaAt:row.pagadaAt,pagadaPorNombre:row.pagadaPorNombre,medioPago:row.medioPago,anuladaAt:row.anuladaAt,motivoAnulacion:row.motivoAnulacion};
}
export async function GET(req:NextRequest){try{
 const user=await requireSession(req),admin=user.rol==='ADMIN',params=req.nextUrl.searchParams;
 const status=params.get('estado')?z.enum(states).parse(params.get('estado')):undefined;
 const beneficiary=params.get('beneficiarioId');if(!admin&&beneficiary&&beneficiary!==user.id)throw new ApiError(403,'Solo puedes consultar tus propias comisiones.');
 const where={...(!admin?{beneficiarioId:user.id}:beneficiary?{beneficiarioId:beneficiary}:{}),...(status?{estado:status}:{})};
 const cursor=params.get('cursor');if(cursor&&!await prisma.comisionTrabajo.findFirst({where:{...where,id:cursor},select:{id:true}}))throw new ApiError(400,'Actualiza el historial para continuar.');
 const [rows,totals]=await Promise.all([prisma.comisionTrabajo.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],take:51,...(cursor?{cursor:{id:cursor},skip:1}:{})}),prisma.comisionTrabajo.groupBy({by:['estado'],where,_sum:{monto:true},_count:{_all:true}})]);
 let personal:unknown=undefined;
 if(admin){const [staff,rules]=await Promise.all([prisma.usuario.findMany({select:{id:true,nombre:true,estado:true,rol:true,sucursal:{select:{nombre:true}}},orderBy:{nombre:'asc'}}),prisma.configuracionComision.findMany()]);personal=staff.map(p=>({...p,configuracion:rules.find(r=>r.usuarioId===p.id)||null}));}
 return NextResponse.json({comisiones:rows.slice(0,50).map(r=>safeRow(r,admin)),siguiente:rows.length>50?rows[49].id:null,totales:totals.map(t=>({estado:t.estado,monto:t._sum.monto||'0',cantidad:t._count._all})),...(admin?{personal}:{})},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return apiError(e);}}
export async function POST(req:NextRequest){try{
 const user=await requireSession(req,['ADMIN']);
 const input=z.discriminatedUnion('accion',[
 z.object({id:z.string().uuid(),accion:z.literal('APROBAR')}).strict(),
 z.object({id:z.string().uuid(),accion:z.literal('PAGAR'),medio:z.enum(['EFECTIVO','TRANSFERENCIA','QR','CHEQUE','OTRO']),referencia:z.string().trim().min(3).max(200),pagoRealizado:z.literal(true)}).strict(),
 z.object({id:z.string().uuid(),accion:z.literal('ANULAR'),motivo:z.string().trim().min(10).max(1000)}).strict(),
 ]).parse(await req.json());
 const result=await prisma.$transaction(async tx=>{
 const locks=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "ComisionTrabajo" WHERE id=${input.id} FOR UPDATE`;
 if(!locks.length)throw new ApiError(404,'Comisión no encontrada.');
 const row=await tx.comisionTrabajo.findUniqueOrThrow({where:{id:input.id}});
 const actor=await tx.usuario.findUniqueOrThrow({where:{id:user.id},select:{nombre:true}});
 const fingerprint=createHash('sha256').update(user.id+JSON.stringify(input)).digest('hex');
 if(input.accion==='PAGAR'&&row.estado==='PAGADA'){if(row.pagoHuella!==fingerprint)throw new ApiError(409,'El pago ya fue registrado con otros datos.');return row;}
 if(input.accion==='APROBAR'&&row.estado==='APROBADA')return row;
 if(input.accion==='ANULAR'&&row.estado==='ANULADA')return row;
 if(!['PENDIENTE','APROBADA'].includes(row.estado))throw new ApiError(409,'Esta comisión no admite esa operación. Las comisiones pagadas conservan su registro financiero.');
 let saved;
 if(input.accion==='ANULAR')saved=await tx.comisionTrabajo.update({where:{id:row.id},data:{estado:'ANULADA',anuladaAt:new Date(),anuladaPorNombre:actor.nombre,motivoAnulacion:input.motivo}});
 else{
   const work=await tx.trabajo.findUnique({where:{id:row.trabajoId},select:{estado:true,egreso:{select:{utilidadNeta:true}},pagos:{select:{monto:true}},cotizaciones:{orderBy:{numeroVersion:'desc'},take:1,select:{estado:true,totalCotizado:true}}}});
   const quote=work?.cotizaciones[0];
   if(!work||work.estado!=='FINALIZADO_FINANCIERO'||!work.egreso||!quote||quote.estado!=='APROBADA'||work.pagos.reduce((sum,p)=>sum+cents(p.monto),0)!==cents(quote.totalCotizado)||!row.utilidadBase.eq(work.egreso.utilidadNeta)||row.monto.lte(0))throw new ApiError(409,'Revisa el cierre y el cobro completo del trabajo antes de liquidar la comisión.');
   if(input.accion==='APROBAR')saved=await tx.comisionTrabajo.update({where:{id:row.id},data:{estado:'APROBADA',aprobadaAt:new Date(),aprobadaPorId:user.id,aprobadaPorNombre:actor.nombre}});
   else{
     if(row.estado!=='APROBADA')throw new ApiError(409,'Aprueba la comisión antes de registrar su pago.');
     const expense=await tx.egresoGeneralManual.create({data:{categoria:'NOMINA',monto:row.monto,descripcion:`Comisión de venta ${row.codigoTrabajo} · ${row.beneficiarioNombre}`,creadoPorId:user.id,proveedorInfo:row.beneficiarioNombre,esRecurrente:false}});
     saved=await tx.comisionTrabajo.update({where:{id:row.id},data:{estado:'PAGADA',pagadaAt:new Date(),pagadaPorId:user.id,pagadaPorNombre:actor.nombre,medioPago:input.medio,referenciaPago:input.referencia,pagoHuella:fingerprint,egresoId:expense.id}});
     await tx.auditoriaLog.create({data:{usuarioId:user.id,modulo:'FINANZAS',accion:'CREATE',entidadTipo:'EgresoGeneralManual',entidadId:expense.id,valoresNuevos:{categoria:'NOMINA',comisionId:row.id,monto:String(row.monto),realizadoPor:actor.nombre}}});
   }
 }
 await tx.auditoriaLog.create({data:{usuarioId:user.id,modulo:'COMISIONES',accion:'UPDATE',entidadTipo:'ComisionTrabajo',entidadId:row.id,valoresAnteriores:{estado:row.estado},valoresNuevos:{estado:saved.estado,realizadoPor:actor.nombre,...(input.accion==='ANULAR'?{motivo:input.motivo}:{}),...(input.accion==='PAGAR'?{medio:input.medio,referencia:input.referencia,egresoId:saved.egresoId}:{})}}});
 if(saved.beneficiarioId)await queueNotice(tx,['personal:'+saved.beneficiarioId],'comision:'+saved.id+':'+saved.estado,'COMISION','Novedades de tu comisión','El administrador actualizó una comisión de tu cuenta.','/comisiones');
 return saved;
 });return NextResponse.json(safeRow(result,true));
}catch(e){return apiError(e);}}

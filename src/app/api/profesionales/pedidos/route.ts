import {NextRequest,NextResponse} from 'next/server';
import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {createHash} from 'node:crypto';
import {prisma} from '@/lib/prisma';
import {requireProfessional} from '@/lib/professional-auth';
import {apiError,ApiError} from '@/lib/api';
import {professionalOrderSchema,professionalPrice,boundedJson} from '@/lib/professional-policy';
import {cents,money} from '@/lib/workflow-policy';
import {queueNotice} from '@/lib/notifications';
import {assignedRoleWhere} from '@/lib/auth';
export async function GET(req:NextRequest){try{const user=await requireProfessional(req);const pedidos=await prisma.pedidoProfesional.findMany({where:{cuentaId:user.id},orderBy:{createdAt:'desc'},take:100,select:{id:true,numero:true,tipo:true,detalle:true,items:true,total:true,descuentoPct:true,estado:true,trabajoId:true,notaGestion:true,createdAt:true}});
 const quotes=await prisma.cotizacion.findMany({where:{trabajoId:{in:pedidos.map(p=>p.trabajoId).filter((id):id is string=>!!id)}},orderBy:{numeroVersion:'desc'},select:{trabajoId:true,numeroVersion:true,totalCotizado:true,estado:true,fechaVencimiento:true}});
 return NextResponse.json({pedidos:pedidos.map(p=>({...p,cotizacion:quotes.find(q=>q.trabajoId===p.trabajoId)||null}))},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return apiError(e);}}
export async function POST(req:NextRequest){try{const user=await requireProfessional(req,true),key=z.string().uuid().parse(req.headers.get('Idempotency-Key')),body=professionalOrderSchema.parse(await boundedJson(req));
 if(body.tipo==='PRODUCTOS'&&(!body.items.length||new Set(body.items.map(i=>i.productoId)).size!==body.items.length))throw new ApiError(400,'Selecciona productos distintos y sus cantidades.');if(body.tipo==='SERVICIO'&&(!body.subtipoCodigo||body.items.length))throw new ApiError(400,'Selecciona el servicio solicitado.');
 const fingerprint=createHash('sha256').update(JSON.stringify(body)).digest('hex');
 const order=await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "CuentaProfesional" WHERE id=${user.id} FOR UPDATE`;const account=await tx.cuentaProfesional.findUniqueOrThrow({where:{id:user.id}});if(account.estado!=='APROBADA')throw new ApiError(403,'Tu acceso profesional requiere revisión del administrador.');
 const prior=await tx.pedidoProfesional.findUnique({where:{id:key}});if(prior){if(prior.cuentaId!==user.id||prior.solicitudHash!==fingerprint)throw new ApiError(409,'La solicitud corresponde a otro pedido.');return prior;}
 const items:Prisma.InputJsonValue[]=[];let total=0;
 if(body.tipo==='PRODUCTOS')for(const line of body.items){const p=await tx.tiendaPublicacion.findFirst({where:{productoId:line.productoId,publicado:true,producto:{activo:true,precioVenta:{gt:0}}},select:{producto:{select:{id:true,nombre:true,codigoSku:true,precioVenta:true,unidadMedida:true}}}});if(!p)throw new ApiError(409,'Un producto ya no está disponible. Actualiza el catálogo.');const retail=cents(p.producto.precioVenta),price=professionalPrice(retail,Number(account.descuentoPct)),subtotal=new Prisma.Decimal(line.cantidad).mul(price).toDecimalPlaces(0).toNumber();total+=subtotal;items.push({productoId:line.productoId,descripcion:p.producto.nombre,sku:p.producto.codigoSku,unidad:p.producto.unidadMedida,cantidad:line.cantidad,precioPublico:money(retail),precio:money(price),subtotal:money(subtotal)});}
 else if(!await tx.catalogoSubtipo.findFirst({where:{codigo:body.subtipoCodigo,activo:true,categoria:{activo:true}}}))throw new ApiError(400,'Servicio no disponible.');
 if(total>999999999999)throw new ApiError(400,'El pedido supera el importe permitido.');
 const saved=await tx.pedidoProfesional.create({data:{id:key,cuentaId:user.id,tipo:body.tipo,subtipoCodigo:body.subtipoCodigo||null,detalle:body.detalle,items,total:body.tipo==='PRODUCTOS'?money(total):null,descuentoPct:account.descuentoPct,solicitudHash:fingerprint}});
 const recipients=await tx.usuario.findMany({where:{estado:'ACTIVO',OR:[assignedRoleWhere('ADMIN'),{sucursalId:account.sucursalId,...assignedRoleWhere('ENCARGADO')}]},select:{id:true}});await queueNotice(tx,recipients.map(u=>'personal:'+u.id),'pedido-profesional:'+saved.id,'PEDIDO','Nuevo pedido profesional','Una empresa instaladora registró una solicitud para tu atención.','/pedidos-profesionales');
 await tx.auditoriaLog.create({data:{modulo:'PEDIDOS_PROFESIONALES',accion:'CREATE',entidadTipo:'PedidoProfesional',entidadId:saved.id,valoresNuevos:{cuentaId:user.id,numero:saved.numero,origen:'PORTAL_PROFESIONAL',descuentoPct:String(account.descuentoPct)}}});return saved;
 });return NextResponse.json({id:order.id,numero:order.numero,total:order.total,estado:order.estado},{status:201});
}catch(e){return apiError(e);}}

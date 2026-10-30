import {NextRequest,NextResponse,after} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/prisma';
import {notificationOwner} from '@/lib/notification-auth';

import {apiError} from '@/lib/api';
import {deliverPushBatch,queueNotice,reconcileReminders} from '@/lib/notifications';
import {vapidKeys} from '@/lib/push-policy';
import {boundedJson} from '@/lib/professional-policy';
export async function GET(req:NextRequest){try{const owner=await notificationOwner(req);
 if(owner.startsWith('personal:'))await reconcileReminders(owner.slice(9));
 try{after(()=>deliverPushBatch());}catch{}
 const pendientes=req.nextUrl.searchParams.get('pendientes')==='1';
 const [notificaciones,noLeidas]=await Promise.all([prisma.notificacion.findMany({where:{destinatario:owner,...(pendientes?{leidaAt:null}:{})},orderBy:[{createdAt:'desc'},{id:'desc'}],take:50,select:{id:true,tipo:true,titulo:true,mensaje:true,ruta:true,leidaAt:true,createdAt:true}}),prisma.notificacion.count({where:{destinatario:owner,leidaAt:null}})]);
 return NextResponse.json({notificaciones,noLeidas,dispositivoActivo:!!(req.cookies.get('servigaz_push_device')?.value&&await prisma.dispositivoPush.findFirst({where:{id:req.cookies.get('servigaz_push_device')!.value,destinatario:owner,activa:true},select:{id:true}})),publicKey:vapidKeys().publicKey},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return apiError(e);}}
export async function PATCH(req:NextRequest){try{const owner=await notificationOwner(req),body=z.object({id:z.string().uuid().optional(),todas:z.literal(true).optional()}).strict().refine(v=>!!v.id||v.todas,'Selecciona una notificación.').parse(await boundedJson(req));
 await prisma.notificacion.updateMany({where:{destinatario:owner,leidaAt:null,...(body.id?{id:body.id}:{})},data:{leidaAt:new Date()}});return NextResponse.json({success:true});
}catch(e){return apiError(e);}}
export async function POST(req:NextRequest){try{const owner=await notificationOwner(req);
 await prisma.$transaction(tx=>queueNotice(tx,[owner],'prueba:'+new Date().toISOString().slice(0,16),'PRUEBA','Servigaz · Aviso de prueba','Las notificaciones están habilitadas para tu cuenta.',owner.startsWith('profesional:')?'/profesionales':'/notificaciones'));
 await deliverPushBatch();return NextResponse.json({success:true});
}catch(e){return apiError(e);}}

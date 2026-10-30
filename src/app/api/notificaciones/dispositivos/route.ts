import {NextRequest,NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {notificationOwner} from '@/lib/notification-auth';
import {subscriptionSchema} from '@/lib/push-policy';
import {apiError,ApiError} from '@/lib/api';
import {boundedJson} from '@/lib/professional-policy';
export async function POST(req:NextRequest){try{const owner=await notificationOwner(req),body=subscriptionSchema.parse(await boundedJson(req));
 const cookie=req.cookies.get('servigaz_push_device')?.value;
 const device=await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${owner}))`;const prior=await tx.dispositivoPush.findUnique({where:{endpoint:body.subscription.endpoint}});
 if(prior&&prior.destinatario!==owner&&prior.id!==cookie&&(prior.activa||prior.p256dh!==body.subscription.keys.p256dh||prior.auth!==body.subscription.keys.auth))throw new ApiError(409,'Este navegador tiene una vinculación anterior. Desactiva sus avisos y vuelve a habilitarlos.');
 if(await tx.dispositivoPush.count({where:{destinatario:owner,activa:true}})>=10&&!(prior?.activa&&prior.destinatario===owner))throw new ApiError(409,'Ya hay diez dispositivos habilitados. Desactiva uno antes de añadir otro.');
 const data={destinatario:owner,p256dh:body.subscription.keys.p256dh,auth:body.subscription.keys.auth,nombre:body.nombre,activa:true};return tx.dispositivoPush.upsert({where:{endpoint:body.subscription.endpoint},create:{endpoint:body.subscription.endpoint,...data},update:data});});
 const response=NextResponse.json({id:device.id,nombre:device.nombre});response.cookies.set('servigaz_push_device',device.id,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:31536000});return response;
}catch(e){return apiError(e);}}
export async function DELETE(req:NextRequest){try{const owner=await notificationOwner(req),id=req.cookies.get('servigaz_push_device')?.value;
 if(id)await prisma.dispositivoPush.updateMany({where:{id,destinatario:owner},data:{activa:false}});
 const response=NextResponse.json({success:true});response.cookies.delete('servigaz_push_device');return response;
}catch(e){return apiError(e);}}

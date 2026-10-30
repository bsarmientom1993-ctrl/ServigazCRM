import {NextRequest,NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {prisma} from '@/lib/prisma';
import {requireSession} from '@/lib/auth';
import {apiError} from '@/lib/api';
import {reconcileReminders,deliverPushBatch} from '@/lib/notifications';
export const maxDuration=60;
export async function GET(req:NextRequest){try{const expected=process.env.CRON_SECRET,provided=req.headers.get('authorization')?.replace(/^Bearer /,'');const cron=expected&&provided&&expected.length>=32&&Buffer.byteLength(expected)===Buffer.byteLength(provided)&&timingSafeEqual(Buffer.from(expected),Buffer.from(provided));if(!cron)await requireSession(req,['ADMIN']);
 const users=await prisma.usuario.findMany({where:{estado:'ACTIVO'},take:200,select:{id:true}});for(let i=0;i<users.length;i+=10)await Promise.all(users.slice(i,i+10).map(u=>reconcileReminders(u.id)));await deliverPushBatch();return NextResponse.json({success:true});
}catch(e){return apiError(e);}}

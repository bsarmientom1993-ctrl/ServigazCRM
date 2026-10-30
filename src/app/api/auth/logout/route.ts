import {NextRequest,NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {requireSession} from '@/lib/auth';
export async function POST(req:NextRequest){const id=req.cookies.get('servigaz_push_device')?.value;if(id){try{const u=await requireSession(req);await prisma.dispositivoPush.updateMany({where:{id,destinatario:'personal:'+u.id},data:{activa:false}});}catch{}}const response=NextResponse.json({success:true});response.cookies.delete('servigaz_token');response.cookies.delete('servigaz_rol');return response;}

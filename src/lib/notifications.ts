import {randomUUID} from 'node:crypto';
import {after} from 'next/server';
import type {Prisma} from '@prisma/client';
import webpush from 'web-push';
import {prisma} from './prisma';
import {vapidKeys,allowedPushEndpoint} from './push-policy';
import {objectRecord} from './gas-data';
import {rolesOf} from './user-roles';
export async function queueNotice(tx:Prisma.TransactionClient,destinatarios:string[],clave:string,tipo:string,titulo:string,mensaje:string,ruta:string){
 if(!ruta.startsWith('/')||ruta.startsWith('//'))throw Error('Ruta de notificación inválida.');
 const owners=[...new Set(destinatarios.filter(d=>/^(personal|profesional):[\w-]{1,100}$/.test(d)))];if(!owners.length)return;
 await tx.notificacion.createMany({data:owners.map(destinatario=>({id:randomUUID(),destinatario,clave,tipo,titulo,mensaje,ruta})),skipDuplicates:true});
 try{after(()=>deliverPushBatch());}catch{/* Outside an HTTP request, the durable outbox is sent by the next authenticated refresh or scheduler. */}
}
export async function queueWorkNotice(tx:Prisma.TransactionClient,work:{id:string;codigoCorrelativo:string;tecnicoId:string|null;encargadoId:string;sucursalId?:string|null;fechasSla?:unknown},actorId:string){
 const event=await tx.auditoriaLog.findFirst({where:{OR:[{entidadId:work.id},{valoresNuevos:{path:['trabajoId'],equals:work.id}}]},orderBy:[{timestamp:'desc'},{id:'desc'}],select:{id:true,modulo:true}});if(!event)return;
 const meta=objectRecord(work.fechasSla),project=objectRecord(objectRecord(meta.gas).proyecto);
 const ids=[work.encargadoId,work.tecnicoId,objectRecord(meta.captadoPor).id,project.responsableId].filter((id):id is string=>typeof id==='string'&&!!id&&id!==actorId);
 const people=ids.length?await tx.usuario.findMany({where:{id:{in:ids},estado:'ACTIVO'},select:{id:true,rol:true,rolesAsignados:true,sucursalId:true}}):[];
 const financial=['COTIZACIONES','PAGOS','CIERRE_FINANCIERO','FINANZAS'].includes(event.modulo);
 for(const person of people){const roles=rolesOf(person),intake=roles.includes('ADMIN')||roles.some(r=>r==='ENCARGADO'||r==='VENTAS')&&(person.id===work.encargadoId||!!person.sucursalId&&person.sucursalId===work.sucursalId),technical=person.id===work.tecnicoId&&roles.includes('TECNICO_FIJO'),projectOwner=person.id===project.responsableId&&roles.some(r=>r==='GESTOR_PROYECTOS'||r==='TECNICO_FIJO');if(!intake&&(financial||!technical&&!projectOwner))continue;const route=projectOwner&&!intake?'/proyectos/'+work.id:technical&&!intake?'/trabajos/'+work.id:'/recepcion/'+work.id;await queueNotice(tx,['personal:'+person.id],'trabajo:'+event.id,'TRABAJO',event.modulo.includes('VISITA')?'Actualización de visita':'Actualización de trabajo',`Hay una actualización en ${work.codigoCorrelativo}. Consulta el siguiente paso.`,route);}
 const pedido=objectRecord(meta.pedidoProfesional);
 if(typeof pedido.cuentaId==='string')await queueNotice(tx,['profesional:'+pedido.cuentaId],'trabajo-profesional:'+event.id,'PEDIDO','Tu solicitud tiene novedades','Servigaz actualizó una solicitud vinculada a tu cuenta.','/profesionales');
}
export async function reconcileReminders(userId:string,force=false){
 const key='recordatorios:'+userId+':'+Math.floor(Date.now()/900000);
 const tick=await prisma.accesoProfesionalRate.upsert({where:{clave:key},create:{clave:key,venceAt:new Date(Date.now()+86400000)},update:{intentos:{increment:1}}});if(tick.intentos>1&&!force)return;
 const user=await prisma.usuario.findUnique({where:{id:userId},select:{id:true,rol:true,rolesAsignados:true,estado:true}});if(!user||user.estado!=='ACTIVO')return;const roles=rolesOf(user),now=new Date(),day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/La_Paz',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const visits=roles.includes('TECNICO_FIJO')?await prisma.visitaTecnica.findMany({where:{tecnicoId:userId,completada:false,fechaProgramada:{gte:new Date(Date.now()-86400000),lte:new Date(Date.now()+86400000)}},take:30,select:{id:true,trabajoId:true,fechaProgramada:true}}):[];
 const followups=roles.some(r=>['ADMIN','ENCARGADO','VENTAS'].includes(r))?await prisma.trabajo.findMany({where:{AND:[{fechasSla:{path:['recepcion','seguimiento','responsableId'],equals:userId}},{estado:{notIn:['FINALIZADO_FINANCIERO','ARCHIVADO','CANCELADO','RECHAZADO']}}]},take:100,select:{id:true,fechasSla:true}}):[];
 const projects=roles.some(r=>['ADMIN','ENCARGADO','GESTOR_PROYECTOS','TECNICO_FIJO'].includes(r))?await prisma.trabajo.findMany({where:{fechasSla:{path:['gas','proyecto','responsableId'],equals:userId},estado:{notIn:['FINALIZADO_FINANCIERO','ARCHIVADO','CANCELADO','RECHAZADO']}},take:100,select:{id:true,fechasSla:true}}):[];
 await prisma.$transaction(async tx=>{
 for(const v of visits)await queueNotice(tx,['personal:'+userId],'visita-recordatorio:'+v.id+':'+day,'VISITA','Visita por atender','Revisa la hora y las indicaciones de una visita pendiente en tu agenda.','/agenda');
 for(const w of followups){const next=objectRecord(objectRecord(objectRecord(w.fechasSla).recepcion).seguimiento).proximoContacto;if(typeof next==='string'&&new Date(next)<=now)await queueNotice(tx,['personal:'+userId],'contacto:'+w.id+':'+day,'SEGUIMIENTO','Contacto pendiente con cliente','Tienes un seguimiento comercial cuya fecha de contacto ya llegó.','/recepcion/'+w.id);}
 for(const w of projects){const project=objectRecord(objectRecord(objectRecord(w.fechasSla).gas).proyecto);if(project.incluido&&project.estado!=='ENTREGADO')await queueNotice(tx,['personal:'+userId],'proyecto:'+w.id+':'+day,'PROYECTO','Seguimiento diario de proyecto','Revisa el estado del proyecto y registra las gestiones o correcciones de hoy.','/proyectos/'+w.id);}
 });
 await prisma.accesoProfesionalRate.deleteMany({where:{venceAt:{lt:now}}});
}
export async function deliverPushBatch(){
 if(process.env.DISABLE_WEB_PUSH==='1')return;
 const rows=await prisma.$transaction(async tx=>{
   const ids=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "Notificacion" WHERE ("pushEstado"='PENDIENTE' OR ("pushEstado"='ENVIANDO' AND "pushClaimAt"<NOW()-INTERVAL '5 minutes')) AND "pushIntentos"<3 ORDER BY "createdAt" ASC LIMIT 10 FOR UPDATE SKIP LOCKED`;
   if(!ids.length)return[];
   await tx.notificacion.updateMany({where:{id:{in:ids.map(x=>x.id)}},data:{pushEstado:'ENVIANDO',pushClaimAt:new Date(),pushIntentos:{increment:1}}});
   return tx.notificacion.findMany({where:{id:{in:ids.map(x=>x.id)}}});
 });
 if(!rows.length)return;
 const keys=vapidKeys();
 await Promise.all(rows.map(async n=>{
   const [kind,id]=n.destinatario.split(':');
   const active=kind==='personal'?await prisma.usuario.findFirst({where:{id,estado:'ACTIVO'},select:{id:true,rol:true,rolesAsignados:true}}):await prisma.cuentaProfesional.findFirst({where:{id,estado:{not:'SUSPENDIDA'}},select:{id:true}});
   const permitted=active&&(kind!=="personal"||rolesOf(active as any).length>0);
   const devices=permitted?await prisma.dispositivoPush.findMany({where:{destinatario:n.destinatario,activa:true}}):[];
   let failed=false;
   await Promise.all(devices.map(async d=>{try{
     if(!allowedPushEndpoint(d.endpoint))throw Error('Invalid push provider');
     await webpush.sendNotification({endpoint:d.endpoint,keys:{p256dh:d.p256dh,auth:d.auth}},JSON.stringify({id:n.id,title:n.titulo,body:n.mensaje,url:n.ruta,tag:n.id}),{vapidDetails:{subject:process.env.WEB_PUSH_SUBJECT||'https://servigaz-crm.vercel.app',...keys},TTL:86400,timeout:4000});
   }catch(e){const status=(e as {statusCode?:number}).statusCode;if(status===404||status===410||status===403)await prisma.dispositivoPush.update({where:{id:d.id},data:{activa:false}});else failed=true;}}));
   await prisma.notificacion.update({where:{id:n.id},data:{pushEstado:failed?(n.pushIntentos>=3?'FALLIDA':'PENDIENTE'):'ENVIADA'}});
 }));
}

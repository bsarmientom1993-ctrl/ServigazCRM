import {createHmac} from 'node:crypto';
import {hasAssignedRole} from './user-roles';
import * as jwt from 'jsonwebtoken';
import type {Prisma} from '@prisma/client';
import {jwtSecret} from './auth';
import {ApiError} from './api';
import {boliviaDay,monthBounds,dayDiscount,lateMinutes} from './personnel-policy';
import {cents,money} from './workflow-policy';
export function attendanceSecret(){return createHmac('sha256',jwtSecret()).update('servigaz-attendance-challenge-v1').digest('hex');}
export function clockToken(userId:string,branch:string,type:string){return jwt.sign({id:userId,sucursalId:branch,tipo:type},attendanceSecret(),{algorithm:'HS256',audience:'marcacion-servigaz',expiresIn:90});}
export function verifyClockToken(token:string,userId:string,branch:string,type:string){try{const t=jwt.verify(token,attendanceSecret(),{algorithms:['HS256'],audience:'marcacion-servigaz'});if(typeof t==='string'||t.id!==userId||t.sucursalId!==branch||t.tipo!==type||typeof t.iat!=='number')throw Error();return t.iat*1000;}catch{throw new ApiError(409,'La solicitud de marcación venció. Vuelve a obtener tu ubicación.');}}
export async function personnelLock(tx:Prisma.TransactionClient,userId:string){await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${'personal:'+userId},0))`;}
export async function editablePeriod(tx:Prisma.TransactionClient,userId:string,period:string){if(await tx.liquidacionPersonal.count({where:{usuarioId:userId,periodo:period,estado:'CERRADA'}}))throw new ApiError(409,'Este período ya fue liquidado. El administrador debe anular su liquidación antes de registrar cambios.');}
export async function laborConfig(tx:Prisma.TransactionClient,userId:string,period=boliviaDay().slice(0,7)){return tx.configuracionLaboral.findFirst({where:{usuarioId:userId,vigenteDesde:{lte:period}},orderBy:{vigenteDesde:'desc'}});}
export async function attendanceBranch(tx:Prisma.TransactionClient,userId:string,branch:string,day=boliviaDay()){
 const config=await laborConfig(tx,userId,day.slice(0,7));if(!config?.activo||day<config.fechaIngreso.toISOString().slice(0,10)||config.fechaBaja&&day>config.fechaBaja.toISOString().slice(0,10))throw new ApiError(409,'El administrador debe habilitar tu configuración laboral para esta fecha.');
 if(!Array.isArray(config.sucursalesAutorizadas)||!config.sucursalesAutorizadas.includes(branch))throw new ApiError(403,'Esta sucursal no está habilitada para tu asistencia.');
 const office=await tx.sucursal.findFirst({where:{id:branch,activo:true},select:{id:true}});const center=await tx.puntoAsistencia.findUnique({where:{sucursalId:branch}});if(!office||!center?.activo)throw new ApiError(409,'El administrador debe configurar y habilitar el punto de ingreso de esta sucursal.');return{config,center};
}
export async function payrollSummary(tx:Prisma.TransactionClient,userId:string,period:string,now=new Date()){
 const {from,to,days}=monthBounds(period),today=boliviaDay(now);
 const frozen=await tx.liquidacionPersonal.findFirst({where:{usuarioId:userId,periodo:period,estado:'CERRADA'},orderBy:{version:'desc'}});if(frozen)return{...(frozen.snapshot as Record<string,unknown>),liquidacion:{id:frozen.id,version:frozen.version,creadoPorNombre:frozen.creadoPorNombre,createdAt:frozen.createdAt},cerrada:true,puedeCerrar:false};
 const [config,rule,person]=await Promise.all([laborConfig(tx,userId,period),tx.reglaNomina.findFirst({where:{vigenteDesde:{lte:period}},orderBy:{vigenteDesde:'desc'}}),tx.usuario.findUnique({where:{id:userId},select:{rol:true,rolesAsignados:true}})]);
 const exempt=!!person&&hasAssignedRole(person,'ADMIN');
 if(!config)return{configurada:false,periodo:period,cerrada:false,dias:[],puedeCerrar:false,motivoBloqueo:'El administrador todavía no configuró el sueldo y la jornada para este período.'};
 const [attendance,leaves,incidents]=await Promise.all([tx.asistenciaPersonal.findMany({where:{usuarioId:userId,fecha:{gte:from,lt:to}},orderBy:{fecha:'asc'}}),tx.permisoPersonal.findMany({where:{usuarioId:userId,fechaPermiso:{gte:from,lt:to}}}),tx.incidenciaPersonal.findMany({where:{usuarioId:userId,fecha:{gte:from,lt:to}}})]);
 const [meta,marks]=await Promise.all([tx.gestionPermiso.findMany({where:{permisoId:{in:leaves.map(p=>p.id)}}}),tx.marcacionPersonal.findMany({where:{asistenciaId:{in:attendance.map(a=>a.id)},tipo:'ENTRADA'},select:{asistenciaId:true,minutosTarde:true}})]);
 const salary=cents(config.sueldoMensual),divisor=rule?.divisorDia||30,control=rule?.inicioControl.toISOString().slice(0,10)||'9999-12-31',holidays=Array.isArray(rule?.diasNoLaborables)?rule.diasNoLaborables:[],week=Array.isArray(config.diasLaborales)?config.diasLaborales:[];
 const ingreso=config.fechaIngreso.toISOString().slice(0,10),baja=config.fechaBaja?.toISOString().slice(0,10)||'9999-12-31';let linkedDays=0,total=0,pending=0,incomplete=0;const details:Record<string,unknown>[]=[];
 for(let i=0;i<days;i++){const date=new Date(from.getTime()+i*86400000),day=date.toISOString().slice(0,10);if(day<ingreso||day>baja||!config.activo)continue;linkedDays++;
  const a=attendance.find(x=>x.fecha.toISOString().slice(0,10)===day),leave=leaves.find(x=>x.fechaPermiso.toISOString().slice(0,10)===day&&x.estado==='APROBADO'),leaveInfo=leave?meta.find(x=>x.permisoId===leave.id):null;
  const justified=incidents.some(x=>x.fecha.toISOString().slice(0,10)===day&&x.estado==='APROBADA'&&x.justificaDia);
  const needsReview=incidents.some(x=>x.fecha.toISOString().slice(0,10)===day&&x.estado==='PENDIENTE')||leaves.some(x=>x.fechaPermiso.toISOString().slice(0,10)===day&&x.estado==='SOLICITADO');
  const working=week.includes(date.getUTCDay())&&!holidays.includes(day);let state='NO_LABORABLE',discount=0,late=0;
  if(working){if(day>today)state='POR_TRANSCURRIR';else if(needsReview){state='REVISION_PENDIENTE';pending++;}else if(justified)state='JUSTIFICADA';else if(leave){state=leaveInfo?.goceHaberes===false?'PERMISO_SIN_GOCE':'PERMISO_CON_GOCE';if(leaveInfo?.goceHaberes===false&&rule)discount=dayDiscount(salary,divisor,100);}else if(exempt)state='ASISTENCIA_NO_REQUERIDA';else if(a?.horaEntrada){late=marks.find(m=>m.asistenciaId===a.id)?.minutosTarde??lateMinutes(day,a.horaEntrada,config.horaEntrada,config.toleranciaMinutos);state=late?'TARDE':'PRESENTE';if(day<today&&!a.horaSalida){state='INCOMPLETO';incomplete++;}else if(late&&rule?.activa&&day>=control)discount=dayDiscount(salary,divisor,Number(rule.descuentoTardanzaPct));}else if(day===today)state='PENDIENTE_HOY';else if(day<control)state='SIN_CONTROL_PREVIO';else{state='FALTA';if(rule?.activa)discount=dayDiscount(salary,divisor,Number(rule.descuentoFaltaPct));}}
  else if(a?.horaEntrada)state='FUERA_DE_CALENDARIO';
  total+=discount;details.push({fecha:day,estado:state,entrada:a?.horaEntrada||null,salida:a?.horaSalida||null,minutosTarde:late,descuento:money(discount)});
 }
 const gross=Math.round(salary*linkedDays/days),deduct=Math.min(gross,total);const reason=!rule?'Configura las reglas de descuentos del período.':!config.activo?'La configuración laboral está inactiva.':period>=today.slice(0,7)?'El período todavía no terminó.':pending?'Resuelve los permisos y solicitudes de revisión pendientes.':incomplete?'Revisa las jornadas con marcaciones incompletas.':'';
 return{configurada:true,asistenciaExenta:exempt,periodo:period,cerrada:false,sueldoMensual:String(config.sueldoMensual),bruto:money(gross),descuentos:money(deduct),neto:money(gross-deduct),descuentosCalculados:money(total),topeAplicado:total>gross,configuracion:{vigenteDesde:config.vigenteDesde,fechaIngreso:ingreso,fechaBaja:config.fechaBaja?baja:null,horaEntrada:config.horaEntrada,horaSalida:config.horaSalida,toleranciaMinutos:config.toleranciaMinutos,diasLaborales:week},reglas:rule?{vigenteDesde:rule.vigenteDesde,inicioControl:control,divisorDia:divisor,faltaPct:String(rule.descuentoFaltaPct),tardanzaPct:String(rule.descuentoTardanzaPct),activas:rule.activa}:null,dias:details,pendientes:pending,incompletos:incomplete,puedeCerrar:!reason,motivoBloqueo:reason,calculadoAl:now.toISOString()};
}

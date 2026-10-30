import type {Prisma} from '@prisma/client';
import {boliviaDay,dateValue,localTime} from './personnel-policy';
import {ApiError} from './api';
export async function hasDailyEntry(db:Prisma.TransactionClient,userId:string,now=new Date()){
 const entry=await db.asistenciaPersonal.findUnique({where:{usuarioId_fecha:{usuarioId:userId,fecha:dateValue(boliviaDay(now))}},select:{horaEntrada:true}});return !!entry?.horaEntrada;
}

export async function attendanceAccess(db:Prisma.TransactionClient,userId:string,now=new Date()){
 const fecha=boliviaDay(now),period=fecha.slice(0,7);
 const [config,attendance,rule]=await Promise.all([
  db.configuracionLaboral.findFirst({where:{usuarioId:userId,vigenteDesde:{lte:period}},orderBy:{vigenteDesde:'desc'}}),
  db.asistenciaPersonal.findUnique({where:{usuarioId_fecha:{usuarioId:userId,fecha:dateValue(fecha)}}}),
  db.reglaNomina.findFirst({where:{vigenteDesde:{lte:period}},orderBy:{vigenteDesde:'desc'}}),
 ]);
 const marcada=!!attendance?.horaEntrada;
 const format=(n:number)=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
 const minutes=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3));
 const horario=config?{entrada:config.horaEntrada,salida:config.horaSalida,desde:format(Math.max(0,minutes(config.horaEntrada)-config.margenEntradaMinutos)),hasta:format(Math.min(1439,minutes(config.horaSalida)+config.margenSalidaMinutos)),margenEntradaMinutos:config.margenEntradaMinutos,margenSalidaMinutos:config.margenSalidaMinutos}:null;
 let motivo='';
 if(!config?.activo||fecha<config.fechaIngreso.toISOString().slice(0,10)||config.fechaBaja&&fecha>config.fechaBaja.toISOString().slice(0,10))motivo='El administrador debe configurar y habilitar tu jornada laboral.';
 else if(!Array.isArray(config.diasLaborales)||!config.diasLaborales.includes(dateValue(fecha).getUTCDay())||Array.isArray(rule?.diasNoLaborables)&&rule.diasNoLaborables.includes(fecha))motivo='Hoy no es un día laboral de tu calendario. No puedes marcar asistencia.';
 else if(now<localTime(fecha,horario!.desde)||now.getTime()>=localTime(fecha,horario!.hasta).getTime()+60000)motivo=`Solo puedes marcar entre ${horario!.desde} y ${horario!.hasta}, hora de Bolivia, incluidos los márgenes configurados.`;
 return{fecha,marcada,requiereAsistencia:!marcada,puedeMarcar:!motivo,horario,motivo};
}
export async function assertAttendanceWindow(db:Prisma.TransactionClient,userId:string,now=new Date()){
 const status=await attendanceAccess(db,userId,now);if(!status.puedeMarcar)throw new ApiError(409,status.motivo);return status;
}
export function attendanceSetupPath(path:string){return path.startsWith('/api/auth/')||path==='/api/personal'||path.startsWith('/api/personal/')||path==='/api/notificaciones'||path.startsWith('/api/notificaciones/');}

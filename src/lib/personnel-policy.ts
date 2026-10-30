import {z} from 'zod';
import {ApiError} from './api';
export const monthSchema=z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
export const dateSchema=z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/).refine(s=>!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s,'Fecha inválida.');
export const timeSchema=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const percentSchema=z.number().finite().min(0).max(100).refine(n=>Math.abs(n*100-Math.round(n*100))<.000001,'Usa hasta dos decimales.');
export const amountSchema=z.number().finite().min(0).max(9999999999.99).refine(n=>Math.abs(n*100-Math.round(n*100))<.00001,'Usa hasta dos decimales.');
export const locationSchema=z.object({latitud:z.number().finite().min(-90).max(90),longitud:z.number().finite().min(-180).max(180),precisionMetros:z.number().finite().positive().max(100000),muestraAt:z.string().datetime({offset:true})}).strict();
export function boliviaDay(now=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/La_Paz',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);return parts.find(p=>p.type==='year')!.value+'-'+parts.find(p=>p.type==='month')!.value+'-'+parts.find(p=>p.type==='day')!.value;}
export const dateValue=(s:string)=>new Date(dateSchema.parse(s)+'T00:00:00Z');
export const localTime=(day:string,hour:string)=>new Date(dateSchema.parse(day)+'T'+timeSchema.parse(hour)+':00-04:00');
export function monthBounds(period:string){monthSchema.parse(period);const from=dateValue(period+'-01'),to=new Date(Date.UTC(from.getUTCFullYear(),from.getUTCMonth()+1,1));return{from,to,days:Math.round((to.getTime()-from.getTime())/86400000)};}
export function distanceMeters(a:number,b:number,c:number,d:number){const rad=(n:number)=>n*Math.PI/180;const h=Math.sin(rad(c-a)/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(rad(d-b)/2)**2;return 6371000*2*Math.asin(Math.sqrt(Math.min(1,h)));}
export function validateLocation(position:z.infer<typeof locationSchema>,center:{latitud:unknown;longitud:unknown},issuedAt:number,now=new Date()){
 const measured=Date.parse(position.muestraAt),age=now.getTime()-measured;
 if(age>60000||age< -15000||measured<issuedAt-5000)throw new ApiError(409,'La ubicación venció o la hora del dispositivo no es correcta. Obtén una ubicación nueva.');
 const distance=distanceMeters(Number(center.latitud),Number(center.longitud),position.latitud,position.longitud);
 if(distance+position.precisionMetros>10)throw new ApiError(409,`No se puede confirmar que estés dentro de los 10 metros del ingreso: distancia ${distance.toFixed(1)} m y precisión ±${position.precisionMetros.toFixed(1)} m. Acércate al ingreso, activa ubicación precisa o solicita revisión.`);
 return distance;
}
export function lateMinutes(day:string,entry:Date,hour:string,tolerance:number,working=true){return working?Math.max(0,Math.ceil((entry.getTime()-localTime(day,hour).getTime()-tolerance*60000)/60000)):0;}
export function dayDiscount(salaryCents:number,divisor:number,pct:number){return Number((BigInt(salaryCents)*BigInt(Math.round(pct*100))+BigInt(divisor*5000))/BigInt(divisor*10000));}

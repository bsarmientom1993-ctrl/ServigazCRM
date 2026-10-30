import {z} from 'zod';
import {ApiError} from './api';
export const documentTypes={REPRESENTANTE:'Documento del representante',EMPRESA:'Documento de la empresa instaladora',OTRO:'Documento adicional solicitado'} as const;
export const requiredDocuments=['REPRESENTANTE','EMPRESA'];
export const registrationSchema=z.object({nombre:z.string().trim().min(3).max(150),empresa:z.string().trim().min(3).max(120),identificacionEmpresa:z.string().trim().min(3).max(60),telefono:z.string().trim().min(7).max(40).refine(s=>s.replace(/\D/g,'').length>=7,'Revisa el teléfono.'),direccion:z.string().trim().min(5).max(500),email:z.string().trim().email().max(254).transform(s=>s.toLowerCase()),password:z.string().min(10,'La contraseña debe tener al menos 10 caracteres.').max(100)}).strict();
export async function boundedJson(req:Request,max=32768){
 if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new ApiError(400,'Envía los datos desde el formulario.');
 const bytes=await boundedBytes(req,max);try{return JSON.parse(bytes.toString('utf8'));}catch{throw new ApiError(400,'Los datos enviados no son válidos.');}
}
export async function boundedBytes(req:Request,max:number){
 if(Number(req.headers.get('content-length')||0)>max)throw new ApiError(413,'El archivo o formulario supera el tamaño permitido.');
 const reader=req.body?.getReader();if(!reader)throw new ApiError(400,'Faltan los datos.');const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new ApiError(413,'El archivo o formulario supera el tamaño permitido.');}chunks.push(value);}return Buffer.concat(chunks);
}
export function professionalPrice(retail:number,discount:number){const bps=Math.round(discount*100);if(!Number.isSafeInteger(retail)||retail<=0||bps<0||bps>=10000)throw new ApiError(400,'Tarifa profesional inválida.');return Math.max(1,retail-Number((BigInt(retail)*BigInt(bps)+5000n)/10000n));}
export const professionalOrderSchema=z.object({tipo:z.enum(['PRODUCTOS','SERVICIO']),detalle:z.string().trim().min(10).max(2000),subtipoCodigo:z.string().trim().min(1).max(100).optional(),items:z.array(z.object({productoId:z.string().uuid(),cantidad:z.number().finite().positive().max(1000).refine(v=>Math.abs(v*100-Math.round(v*100))<.000001,'Usa cantidades con hasta dos decimales.')} ).strict()).max(30).default([])}).strict();

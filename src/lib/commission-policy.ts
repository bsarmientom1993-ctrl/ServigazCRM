import {z} from 'zod';
export const commissionConfigSchema=z.object({usuarioId:z.string().min(1).max(100),porcentaje:z.number().finite().min(0).max(100).refine(v=>Number.isInteger(Number((v*100).toFixed(6))),'Usa un porcentaje con hasta dos decimales.'),activa:z.boolean()}).strict();
export function commissionCents(profit:number,percentage:number){
 if(!Number.isSafeInteger(profit)||!Number.isFinite(percentage)||percentage<0||percentage>100)throw Error('Cálculo de comisión inválido.');
 const bps=BigInt(Math.round(percentage*100)),base=BigInt(Math.max(0,profit));
 return Number((base*bps+5000n)/10000n);
}

import {createECDH,hkdfSync} from 'node:crypto';
import {jwtSecret} from './auth';
import {z} from 'zod';
export function vapidKeys(){
 if(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY)return{publicKey:process.env.VAPID_PUBLIC_KEY,privateKey:process.env.VAPID_PRIVATE_KEY};
 const key=Buffer.from(hkdfSync('sha256',Buffer.from(jwtSecret()),Buffer.from('servigaz-push-v1'),Buffer.from('vapid-ec-key'),32));
 const ecdh=createECDH('prime256v1');ecdh.setPrivateKey(key);
 return{privateKey:key.toString('base64url'),publicKey:ecdh.getPublicKey().toString('base64url')};
}
export function allowedPushEndpoint(value:string){try{const u=new URL(value),h=u.hostname.toLowerCase();return u.protocol==='https:'&&(!u.port||u.port==='443')&&!u.username&&!u.password&&!u.hash&&(h==='fcm.googleapis.com'||h==='updates.push.services.mozilla.com'||h.endsWith('.push.services.mozilla.com')||h==='web.push.apple.com'||h.endsWith('.push.apple.com')||h.endsWith('.notify.windows.com'));}catch{return false;}}
export const subscriptionSchema=z.object({nombre:z.string().trim().min(1).max(80),subscription:z.object({endpoint:z.string().max(2000).refine(allowedPushEndpoint,'El proveedor de notificaciones no está admitido.'),keys:z.object({p256dh:z.string().regex(/^[\w-]{87}$/),auth:z.string().regex(/^[\w-]{22}$/)}).strict()}).strict()}).strict();

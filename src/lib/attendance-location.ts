import type {AttendancePosition} from '@/components/AttendanceProximityMap';

export class AttendanceLocationError extends Error {
 constructor(public reason:'blocked'|'unavailable'|'timeout'|'insecure',message:string){super(message);this.name='AttendanceLocationError';}
}

// Called only from an explicit location/clock action. Never watches the worker.
export async function getAttendancePosition({secureContext,geolocation}:{secureContext:boolean;geolocation?:Pick<Geolocation,'getCurrentPosition'>}):Promise<AttendancePosition>{
 if(!secureContext)throw new AttendanceLocationError('insecure','Abre Servigaz desde su dirección HTTPS para compartir tu ubicación.');
 if(!geolocation)throw new AttendanceLocationError('unavailable','Este navegador no ofrece ubicación. Abre Servigaz en Chrome o Safari en tu teléfono.');
 const position=await new Promise<GeolocationPosition>((resolve,reject)=>geolocation.getCurrentPosition(resolve,error=>reject(error.code===1?new AttendanceLocationError('blocked','El permiso de ubicación está bloqueado. Actívalo para Servigaz en los ajustes del navegador y vuelve a intentarlo.'):error.code===3?new AttendanceLocationError('timeout','La ubicación tardó demasiado. Activa la ubicación del teléfono, acércate al ingreso y vuelve a intentarlo.'):new AttendanceLocationError('unavailable','No se pudo obtener tu ubicación. Comprueba que la ubicación del teléfono esté activada y vuelve a intentarlo.')),{enableHighAccuracy:true,maximumAge:0,timeout:20000}));
 return {latitud:position.coords.latitude,longitud:position.coords.longitude,precisionMetros:position.coords.accuracy,muestraAt:new Date(position.timestamp).toISOString()};
}

import {NextRequest,NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {requireSession} from '@/lib/auth';
import {apiError,ApiError} from '@/lib/api';
import {boliviaDay,monthSchema} from '@/lib/personnel-policy';
import {laborConfig,payrollSummary} from '@/lib/personnel';
export async function GET(req:NextRequest){try{
 const actor=await requireSession(req),admin=actor.rol==='ADMIN',target=req.nextUrl.searchParams.get('usuarioId')||actor.id;
 if(!admin&&target!==actor.id)throw new ApiError(403,'Solo puedes consultar tu propia información laboral.');
 const period=monthSchema.parse(req.nextUrl.searchParams.get('periodo')||boliviaDay().slice(0,7)),bounds={gte:new Date(period+'-01T00:00:00Z'),lt:new Date(Date.UTC(Number(period.slice(0,4)),Number(period.slice(5,7)),1))};
 const result=await prisma.$transaction(async tx=>{
  const person=await tx.usuario.findUnique({where:{id:target},select:{id:true,nombre:true,rol:true,estado:true}});if(!person)throw new ApiError(404,'Persona no encontrada.');
  const [summary,config,attendance,leaves,incidents,allBranches,points,history]=await Promise.all([payrollSummary(tx,target,period),laborConfig(tx,target),tx.asistenciaPersonal.findMany({where:{usuarioId:target,fecha:bounds},orderBy:{fecha:'desc'}}),tx.permisoPersonal.findMany({where:{usuarioId:target},orderBy:{fechaSolicitud:'desc'},take:100}),tx.incidenciaPersonal.findMany({where:{usuarioId:target},orderBy:{createdAt:'desc'},take:100}),tx.sucursal.findMany({where:{activo:true},select:{id:true,nombre:true}}),tx.puntoAsistencia.findMany(),tx.liquidacionPersonal.findMany({where:{usuarioId:target,periodo:period},orderBy:{version:'desc'},select:{id:true,version:true,estado:true,totalBruto:true,totalDescuentos:true,totalNeto:true,creadoPorNombre:true,createdAt:true,motivoAnulacion:true}})]);
  const leaveMeta=await tx.gestionPermiso.findMany({where:{permisoId:{in:leaves.map(p=>p.id)}}});
  const authorized=Array.isArray(config?.sucursalesAutorizadas)?config.sucursalesAutorizadas:[];
  const branches=allBranches.filter(b=>admin||authorized.includes(b.id)).map(b=>{const p=points.find(p=>p.sucursalId===b.id);return{...b,punto:p?{latitud:p.latitud,longitud:p.longitud,activo:p.activo,radioMetros:10}:null};});
  const extra=admin?{personal:await tx.usuario.findMany({orderBy:{nombre:'asc'},select:{id:true,nombre:true,estado:true,rol:true}}),configuraciones:await tx.configuracionLaboral.findMany({where:{usuarioId:target},orderBy:{vigenteDesde:'desc'}}),reglas:await tx.reglaNomina.findMany({orderBy:{vigenteDesde:'desc'}})}:{};
  const pendientesPersonal=admin?[
   ...(await tx.permisoPersonal.findMany({where:{estado:'SOLICITADO'},orderBy:{fechaSolicitud:'asc'},take:100,select:{id:true,usuarioId:true,fechaPermiso:true}})).map(p=>({id:p.id,usuarioId:p.usuarioId,fecha:p.fechaPermiso,tipo:'Permiso'})),
   ...(await tx.incidenciaPersonal.findMany({where:{estado:'PENDIENTE'},orderBy:{createdAt:'asc'},take:100,select:{id:true,usuarioId:true,fecha:true}})).map(p=>({...p,tipo:'Revisión de asistencia'})),
  ]:undefined;
  return{persona:person,resumen:summary,configuracion:config,sucursales:branches,asistencias:attendance.map(a=>({id:a.id,fecha:a.fecha,horaEntrada:a.horaEntrada,horaSalida:a.horaSalida,estado:a.estado})),permisos:leaves.map(p=>({...p,gestion:leaveMeta.find(m=>m.permisoId===p.id)||null})),incidencias:incidents,liquidaciones:history,...extra,...(admin?{pendientesPersonal}:{})};
 },{timeout:20000});
 return NextResponse.json(result,{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return apiError(e);}}

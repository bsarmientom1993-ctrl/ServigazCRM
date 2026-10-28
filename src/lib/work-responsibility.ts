import { Prisma } from '@prisma/client';
import { ApiError } from './api';
import { assertWorkAccess, Session, workScope } from './auth';
import { gasData, objectRecord } from './gas-data';
export { isIndependentProject, commercialOrigin } from './work-responsibility-data';
export async function activeTeamMember(tx:Prisma.TransactionClient,user:Session,id:string,branchId:string|null){
  const person=await tx.usuario.findUnique({where:{id},select:{id:true,nombre:true,estado:true,sucursalId:true}});
  if(!person||person.estado!=='ACTIVO'||user.rol!=='ADMIN'&&person.sucursalId!==branchId)throw new ApiError(403,'Selecciona una persona activa de tu equipo.');
  return {id:person.id,nombre:person.nombre};
}
export function projectScope(user:Session):Prisma.TrabajoWhereInput {return user.rol==='TECNICO_FIJO'?{fechasSla:{path:['gas','proyecto','responsableId'],equals:user.id}}:workScope(user);}
export function assertProjectAccess(user:Session,work:any){if(user.rol==='TECNICO_FIJO'){if(gasData(work).proyecto?.responsableId!==user.id)throw new ApiError(403,'El proyecto no está asignado a tu seguimiento.');}else assertWorkAccess(user,work);}

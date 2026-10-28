import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {requireSession,managers} from '@/lib/auth';
import {ApiError,apiError} from '@/lib/api';
import {withWork} from '@/lib/workflow';
import {gasData,objectRecord} from '@/lib/gas-data';
import {activeTeamMember} from '@/lib/work-responsibility';
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{
 const user=await requireSession(req,managers),{id}=await params;
 const input=z.object({captadoPorId:z.string().trim().max(100),responsableId:z.string().trim().max(100)}).parse(await req.json());
 const result=await withWork(id,user,async(tx,actor)=>{
  const work=await tx.trabajo.findUniqueOrThrow({where:{id}}),metadata=objectRecord(work.fechasSla),gas=structuredClone(gasData(work));
  if(input.responsableId&&!gas.proyecto?.incluido)throw new ApiError(409,'El trabajo no incluye proyecto.');
  const origin=input.captadoPorId?await activeTeamMember(tx,user,input.captadoPorId,work.sucursalId):null;
  const responsible=input.responsableId?await activeTeamMember(tx,user,input.responsableId,work.sucursalId):null;
  if(gas.proyecto)gas.proyecto={...gas.proyecto,responsableId:responsible?.id||'',responsable:responsible?.nombre||''};
  await tx.trabajo.update({where:{id},data:{fechasSla:JSON.parse(JSON.stringify({...metadata,captadoPor:origin,gas}))}});
  await tx.auditoriaLog.create({data:{usuarioId:user.id,modulo:gas.proyecto?.incluido?'PROYECTO_GAS':'RESPONSABILIDADES',accion:'UPDATE',entidadTipo:gas.proyecto?.incluido?'ProyectoGas':'Trabajo',entidadId:id,valoresAnteriores:{captadoPor:metadata.captadoPor||null,responsableId:gasData(work).proyecto?.responsableId||null},valoresNuevos:{accion:"ASIGNAR_RESPONSABLES",realizadoPor:actor.nombre,captadoPor:origin,responsableSeguimiento:responsible,...(gas.proyecto?{proyecto:{...gas.proyecto,observaciones:"Conseguido por: "+(origin?.nombre||"Sin registrar")+". Seguimiento: "+(responsible?.nombre||"Sin asignar")}}:{})}}});
  return {success:true};
 });return NextResponse.json(result);
}catch(error){return apiError(error);}}

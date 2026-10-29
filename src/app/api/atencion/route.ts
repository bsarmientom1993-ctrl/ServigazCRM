import {objectRecord} from "@/lib/gas-data";
import {NextRequest,NextResponse} from 'next/server';
import {requireSession,intakeOperators,workScope} from '@/lib/auth';
import {apiError} from '@/lib/api';
import {prisma} from '@/lib/prisma';
export async function GET(req:NextRequest){try{
 const user=await requireSession(req,intakeOperators);
 const trabajos=await prisma.trabajo.findMany({where:workScope(user),select:{fechasSla:true,id:true,codigoCorrelativo:true,subtipoNombre:true,estado:true,createdAt:true,cliente:{select:{nombreCompleto:true,telefonos:true,direccion:true}},tecnico:{select:{id:true,nombre:true}},visitas:{where:{completada:false},orderBy:{fechaProgramada:'asc'},take:1,select:{fechaProgramada:true}},cotizaciones:{orderBy:{numeroVersion:'desc'},take:1,select:{estado:true,totalCotizado:true,fechaVencimiento:true}}},orderBy:{createdAt:'desc'},take:300});
 return NextResponse.json({trabajos:trabajos.map(({fechasSla,...w})=>{const p=objectRecord(objectRecord(fechasSla).preferenciaCliente);return {...w,preferenciaCliente:{fecha:p.fecha||"",desde:p.desde||"",hasta:p.hasta||""}};})});
}catch(e){return apiError(e);}}

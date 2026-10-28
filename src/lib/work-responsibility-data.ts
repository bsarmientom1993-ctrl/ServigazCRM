import { objectRecord } from './gas-data';
export function isIndependentProject(work:{fechasSla?:unknown}) {return objectRecord(work.fechasSla).modalidad==='PROYECTO_INDEPENDIENTE';}
export function commercialOrigin(work:{fechasSla?:unknown}) {const value=objectRecord(objectRecord(work.fechasSla).captadoPor);return {id:String(value.id||''),nombre:String(value.nombre||'')};}

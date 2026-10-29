export const availableRoles = ['ADMIN','ENCARGADO','TECNICO_FIJO','ENCARGADO_TIENDA'] as const;
export type UserRole = typeof availableRoles[number];
export const roleLabels:Record<UserRole,string>={ADMIN:'Administrador',ENCARGADO:'Encargado',TECNICO_FIJO:'Técnico',ENCARGADO_TIENDA:'Encargado de tienda'};
export const roleDescriptions:Record<UserRole,string>={ADMIN:'Administración completa, finanzas y gestión de usuarios.',ENCARGADO:'Clientes, cotizaciones, proyectos y coordinación de su sucursal.',TECNICO_FIJO:'Agenda, trabajos asignados y materiales, sin precios.',ENCARGADO_TIENDA:'Inventario, proformas y entregas de todas las tiendas.'};
export function rolesOf(user:{rol:string;rolesAsignados?:unknown}):UserRole[]{
  if(user.rolesAsignados===null||user.rolesAsignados===undefined)return availableRoles.includes(user.rol as UserRole)?[user.rol as UserRole]:[];
  if(!Array.isArray(user.rolesAsignados))return [];
  return availableRoles.filter(role=>(user.rolesAsignados as unknown[]).includes(role));
}
export function hasAssignedRole(user:{rol:string;rolesAsignados?:unknown},role:UserRole){return rolesOf(user).includes(role);}
export function activeRole(user:{rol:string;rolesAsignados?:unknown},requested?:string):UserRole|null{
  const assigned=rolesOf(user);return requested&&assigned.includes(requested as UserRole)?requested as UserRole:assigned.includes(user.rol as UserRole)?user.rol as UserRole:assigned[0]||null;
}
export function roleHome(role:string){return role==='ENCARGADO_TIENDA'?'/inventario':role==='TECNICO_FIJO'?'/agenda':'/dashboard';}

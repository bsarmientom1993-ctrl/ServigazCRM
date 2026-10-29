export const availableRoles = ['ADMIN','ENCARGADO','VENTAS','SUPERVISOR','GESTOR_PROYECTOS','TECNICO_FIJO','ALMACENERO','ENCARGADO_TIENDA','CAJA'] as const;
export type UserRole = typeof availableRoles[number];
export const roleLabels:Record<UserRole,string>={ADMIN:'Administrador',ENCARGADO:'Encargado de sucursal',VENTAS:'Atención al cliente y ventas',SUPERVISOR:'Supervisor técnico',GESTOR_PROYECTOS:'Gestor de proyectos',TECNICO_FIJO:'Técnico',ALMACENERO:'Responsable de almacén',ENCARGADO_TIENDA:'Encargado de tienda',CAJA:'Caja y finanzas'};
export const roleDescriptions:Record<UserRole,string>={ADMIN:'Administración completa, finanzas y gestión de usuarios.',ENCARGADO:'Cotizaciones finales, coordinación y cierres de su sucursal.',VENTAS:'Clientes, solicitudes, visitas y proformas comerciales; sin emisión de cotizaciones finales.',SUPERVISOR:'Mediciones, visto bueno técnico y control de calidad; sin precios.',GESTOR_PROYECTOS:'Seguimiento, observaciones y documentos de sus proyectos asignados; sin precios.',TECNICO_FIJO:'Agenda, trabajos asignados y materiales, sin precios.',ALMACENERO:'Compras de inventario, almacenes centrales y de su sucursal, abastecimiento y entregas.',ENCARGADO_TIENDA:'Inventario, proformas y entregas de todas las tiendas.',CAJA:'Cobros y egresos, conciliación y preparación de cierres de su sucursal; sin rentabilidad global.'};
export function rolesOf(user:{rol:string;rolesAsignados?:unknown}):UserRole[]{
  if(user.rolesAsignados===null||user.rolesAsignados===undefined)return availableRoles.includes(user.rol as UserRole)?[user.rol as UserRole]:[];
  if(!Array.isArray(user.rolesAsignados))return [];
  return availableRoles.filter(role=>(user.rolesAsignados as unknown[]).includes(role));
}
export function hasAssignedRole(user:{rol:string;rolesAsignados?:unknown},role:UserRole){return rolesOf(user).includes(role);}
export function activeRole(user:{rol:string;rolesAsignados?:unknown},requested?:string):UserRole|null{
  const assigned=rolesOf(user);return requested&&assigned.includes(requested as UserRole)?requested as UserRole:assigned.includes(user.rol as UserRole)?user.rol as UserRole:assigned[0]||null;
}
export function roleHome(role:string){return ({VENTAS:'/atencion',SUPERVISOR:'/supervision',GESTOR_PROYECTOS:'/proyectos',ALMACENERO:'/inventario',CAJA:'/caja',ENCARGADO_TIENDA:'/inventario',TECNICO_FIJO:'/agenda'} as Record<string,string>)[role]||'/dashboard';}

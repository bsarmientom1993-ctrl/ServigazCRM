export const storeRole = 'ENCARGADO_TIENDA' as const;
export function storeApiAllowed(path:string,method:string){
 const permissions:Record<string,string[]>={
  '/api/auth/me':['GET','PATCH'],'/api/auth/logout':['POST'],
  '/api/inventario':['GET','POST'],'/api/inventario/compras':['GET','POST'],
  '/api/inventario/movimientos':['GET'],'/api/inventario/minimos':['PATCH'],
  '/api/inventario/traspasos':['GET','POST','PATCH'],'/api/ubicaciones':['GET'],
  '/api/proformas':['GET','POST','PATCH'],'/api/proformas/opciones':['GET','POST'],'/api/entregas':['GET','POST','PATCH'],
 };
 return Boolean(permissions[path]?.includes(method));
}
export function storePageAllowed(path:string){return path==='/inventario'||path.startsWith('/inventario/')||path==='/perfil'||path==='/proformas'||path.startsWith('/proformas/')||path==='/entregas'||path.startsWith('/entregas/');}

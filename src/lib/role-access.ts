import {storeApiAllowed,storePageAllowed} from './store-role';
export function roleApiAllowed(role:string,path:string,method:string){
  if(path==='/api/personal/acceso'&&method==='GET')return true;
  if(path==='/api/personal'&&method==='GET'||['/api/personal/marcacion','/api/personal/permisos','/api/personal/incidencias'].includes(path)&&method==='POST')return true;
  if(path==='/api/notificaciones'&&['GET','POST','PATCH'].includes(method)||path==='/api/notificaciones/dispositivos'&&['POST','DELETE'].includes(method))return true;
  if(path==='/api/comisiones'&&method==='GET')return true;
  if(role==='ENCARGADO_TIENDA')return storeApiAllowed(path,method);
  if(['ADMIN','ENCARGADO','TECNICO_FIJO'].includes(role))return true;
  const common:Record<string,string[]>={'/api/auth/me':['GET','PATCH'],'/api/auth/logout':['POST'],'/api/auth/rol':['POST']};
  const inventory:Record<string,string[]>={'/api/inventario':['GET','POST'],'/api/inventario/compras':['GET','POST'],'/api/inventario/movimientos':['GET'],'/api/inventario/minimos':['PATCH'],'/api/inventario/traspasos':['GET','POST','PATCH'],'/api/ubicaciones':['GET'],'/api/proformas':['GET','POST','PATCH'],'/api/proformas/opciones':['GET'],'/api/entregas':['GET','POST','PATCH']};
  const routes:Record<string,Record<string,string[]>>={VENTAS:{'/api/atencion':['GET'],'/api/clientes':['GET','POST'],'/api/catalogo/servicios':['GET'],'/api/tecnicos':['GET'],'/api/tecnicos/disponibilidad':['GET'],'/api/equipo':['GET'],'/api/trabajos':['POST'],'/api/proformas':['GET','POST'],'/api/proformas/opciones':['GET','POST']},SUPERVISOR:{'/api/supervision':['GET','POST']},GESTOR_PROYECTOS:{'/api/proyectos':['GET']},ALMACENERO:inventory,CAJA:{'/api/caja':['GET','POST'],'/api/finanzas':['GET','POST']}};
  if(common[path]?.includes(method)||routes[role]?.[path]?.includes(method))return true;
  if(role==='VENTAS'&&path==='/api/pedidos-profesionales'&&['GET','PATCH'].includes(method))return true;
  if(role==='VENTAS'&&(path==='/api/recepcion'&&method==='GET'||/^\/api\/recepcion\/[^/]+$/.test(path)&&['GET','POST'].includes(method)))return true;
  if(role==='VENTAS'&&/^\/api\/trabajos\/[^/]+\/fotos(?:\/[^/]+)?$/.test(path)&&['GET','POST'].includes(method))return true;
  if(role==='VENTAS'&&/^\/api\/trabajos\/[^/]+\/visita$/.test(path)&&method==='POST')return true;
  if(role==='GESTOR_PROYECTOS'&&/^\/api\/trabajos\/[^/]+\/proyecto$/.test(path)&&['GET','POST'].includes(method))return true;
  if(role==='SUPERVISOR'&&/^\/api\/trabajos\/[^/]+\/ejecucion$/.test(path)&&method==='POST')return true;
  if(role==='SUPERVISOR'&&/^\/api\/trabajos\/[^/]+\/fotos(?:\/[^/]+)?$/.test(path)&&method==='GET')return true;
  if(role==='CAJA'&&/^\/api\/trabajos\/[^/]+\/pagos$/.test(path)&&method==='POST')return true;
  return false;
}
export function rolePageAllowed(role:string,path:string){
  if(path==='/personal'||path==='/asistencia')return true;
  if(path==='/empresas-instaladoras')return role==='ADMIN';
  if(path==='/pedidos-profesionales')return ['ADMIN','ENCARGADO','VENTAS'].includes(role);
  if(path==='/notificaciones')return true;
  if(path==='/comisiones')return true;
  if(role==='ENCARGADO_TIENDA')return storePageAllowed(path);
  if(['ADMIN','ENCARGADO','TECNICO_FIJO'].includes(role))return true;
  if(path==='/perfil')return true;
  if(role==='VENTAS'&&path==='/pedidos-profesionales')return true;
  if(role==='VENTAS'&&(path==='/recepcion'||/^\/recepcion\/[^/]+(?:\/comprobante)?$/.test(path)))return true;
  if(role==='VENTAS')return ['/atencion','/clientes','/trabajos/nuevo'].includes(path)||path==='/proformas'||path.startsWith('/proformas/');
  if(role==='SUPERVISOR')return path==='/supervision';
  if(role==='GESTOR_PROYECTOS')return path==='/proyectos'||/^\/proyectos\/[^/]+$/.test(path)&&path!=='/proyectos/nuevo';
  if(role==='ALMACENERO')return path==='/inventario'||path.startsWith('/inventario/')||path==='/proformas'||path.startsWith('/proformas/')||path==='/entregas'||path.startsWith('/entregas/');
  if(role==='CAJA')return path==='/caja';
  return false;
}

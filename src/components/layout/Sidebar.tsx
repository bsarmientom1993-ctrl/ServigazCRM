"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {RoleSwitcher} from './RoleSwitcher';
import {roleLabels,roleHome} from "@/lib/user-roles";
import { LayoutDashboard, BriefcaseBusiness, Calculator, Users, Clock3, Package, Settings2, Award, LogOut, ChevronRight, MapPin, Wallet, X, Building2, CircleHelp, FolderClock, FileClock, ShoppingBag, Search } from "lucide-react";

export function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const ref = useRef<HTMLElement>(null);
  const [mobile, setMobile] = useState(false);
  const [menuQuery,setMenuQuery]=useState('');
  useEffect(()=>setMenuQuery(''),[pathname]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setMobile(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(ref.current?.querySelectorAll<HTMLElement>("a[href],button:not([disabled])") || []).filter(item => item.getClientRects().length > 0);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
      if (event.key === "Tab") {
        const items = focusable(), first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [open, onClose]);
  if (!user) return null;
  const store = user.rol === "ENCARGADO_TIENDA";const warehouse=user.rol==="ALMACENERO",sales=user.rol==="VENTAS",tech=user.rol==="TECNICO_FIJO";
  const manager = user.rol === "ADMIN" || user.rol === "ENCARGADO";
  const navigation = [
    {name:'Empresas instaladoras',href:'/empresas-instaladoras',icon:Building2,show:user.rol==='ADMIN',group:'gestion'},
    {name:'Pedidos profesionales',href:'/pedidos-profesionales',icon:ShoppingBag,show:manager||sales,group:'principal'},
    {name:'Notificaciones',href:'/notificaciones',icon:Clock3,show:true,group:'gestion'},
    {name:user.rol==='ADMIN'?'Comisiones del equipo':'Mis comisiones',href:'/comisiones',icon:Wallet,show:true,group:'gestion'},
    {name:"Recepción en sucursal",href:"/recepcion",icon:Users,show:manager||sales,group:"principal"},
    {name:"Atención al cliente y ventas",href:"/atencion",icon:Users,show:manager||sales,group:"principal"},
    {name:"Supervisión técnica",href:"/supervision",icon:BriefcaseBusiness,show:manager||user.rol==="SUPERVISOR",group:"principal"},
    {name:"Caja y conciliación",href:"/caja",icon:Wallet,show:manager||user.rol==="CAJA",group:"principal"},
    { name: manager ? "Resumen" : "Mi agenda", href: manager ? "/dashboard" : "/agenda", icon: LayoutDashboard, show: manager || tech, group: "principal" },
    { name: manager ? "Trabajos y órdenes" : "Mis trabajos", href: "/trabajos", icon: BriefcaseBusiness, show: manager || tech, group: "principal" },
    { name: "Cotizaciones pendientes", href: "/cotizaciones", icon: FileClock, show: manager, group: "principal" },
    { name: user.rol === "TECNICO_FIJO" ? "Mis solicitudes de material" : "Proformas y solicitudes", href: "/proformas", icon: FileClock, show: manager||tech||store||warehouse||sales, group: "principal" },
    { name: user.rol === "TECNICO_FIJO" ? "Mis materiales" : "Entrega de material", href: "/entregas", icon: Package, show: manager||tech||store||warehouse, group: "principal" },
    { name: "Proyectos", href: "/proyectos", icon: FolderClock, show: manager || tech || user.rol==="GESTOR_PROYECTOS", group: "principal" },
    { name: "Clientes", href: "/clientes", icon: Users, show: manager||sales, group: "principal" },
    { name: "Cotizador", href: "/cotizador", icon: Calculator, show: manager, group: "principal" },
    { name: "Catálogo de tienda pública", href: "/gestion-tienda", icon: ShoppingBag, show: user.rol === "ADMIN", group: "gestion" },
    { name: "Sucursales y ubicaciones", href: "/sucursales", icon: Building2, show: manager, group: "gestion" },
    { name: store ? "Inventario de tiendas" : "Almacenes y tiendas", href: "/inventario", icon: Package, show: manager || store || warehouse, group: "gestion" },
    { name: "Balance y gastos", href: "/finanzas", icon: Wallet, show: user.rol === "ADMIN", group: "gestion" },
    { name: "Garantías", href: "/garantias", icon: Award, show: manager, group: "gestion" },
    { name: "Ayuda y práctica", href: "/ayuda", icon: CircleHelp, show: manager||tech, group: "gestion" },
    { name: user.rol === "ADMIN" ? "Usuarios y roles" : "Mi perfil", href: "/perfil", icon: Users, show: true, group: "gestion" },
    { name: user.rol === "ADMIN" ? "Personal, sueldos y asistencia" : "Mi personal y asistencia", href: "/personal", icon: Clock3, show: true, group: "gestion" },
    { name: "Precios y tarifas", href: "/configuracion", icon: Settings2, show: manager, group: "gestion" },
  ];
  const adminGroups=[{id:'inicio',label:'INICIO'},{id:'ventas',label:'Clientes y ventas'},{id:'operacion',label:'Trabajos y proyectos'},{id:'inventario',label:'Inventario y tienda'},{id:'finanzas',label:'Caja y finanzas'},{id:'administracion',label:'Personal y configuración'},{id:'equipo',label:'Vistas del equipo'},{id:'ayuda',label:'AYUDA Y AVISOS'}];
  const adminAreas:Record<string,string>={'/dashboard':'inicio','/recepcion':'ventas','/clientes':'ventas','/cotizaciones':'ventas','/cotizador':'ventas','/proformas':'ventas','/pedidos-profesionales':'ventas','/empresas-instaladoras':'ventas','/trabajos':'operacion','/proyectos':'operacion','/garantias':'operacion','/inventario':'inventario','/entregas':'inventario','/gestion-tienda':'inventario','/finanzas':'finanzas','/caja':'finanzas','/comisiones':'finanzas','/personal':'administracion','/perfil':'administracion','/sucursales':'administracion','/configuracion':'administracion','/atencion':'equipo','/supervision':'equipo','/notificaciones':'ayuda','/ayuda':'ayuda'};
  const admin=user.rol==='ADMIN';
  const adminOrder=['/dashboard','/recepcion','/clientes','/cotizaciones','/cotizador','/proformas','/pedidos-profesionales','/empresas-instaladoras','/trabajos','/proyectos','/garantias','/inventario','/entregas','/gestion-tienda','/caja','/finanzas','/comisiones','/personal','/perfil','/sucursales','/configuracion','/atencion','/supervision','/notificaciones','/ayuda'];
  const menu=admin?navigation.map(item=>({...item,group:adminAreas[item.href]||item.group})).sort((a,b)=>adminOrder.indexOf(a.href)-adminOrder.indexOf(b.href)):navigation;
  const groups=admin?adminGroups:[{id:'principal',label:'ESPACIO DE TRABAJO'},{id:'gestion',label:'GESTIÓN'}];
  const descriptions:Record<string,string>={'/dashboard':'Pendientes y avance de la operación.','/recepcion':'Registrar lo que necesita un cliente nuevo o existente.','/clientes':'Buscar clientes y consultar su historial.','/cotizaciones':'Preparar propuestas y dar seguimiento.','/cotizador':'Calcular una propuesta vinculada a un cliente.','/proformas':tech||warehouse?'Solicitar materiales para trabajos y revisar su aprobación.':'Proformas de clientes y solicitudes de material.','/pedidos-profesionales':'Revisar pedidos de empresas instaladoras.','/empresas-instaladoras':'Verificar documentos y aprobar empresas.','/trabajos':tech?'Consultar tus trabajos asignados y registrar la ejecución.':'Visitas, ejecución y cierre de trabajos.','/proyectos':tech?'Consultar los proyectos asociados a tus trabajos.':'Seguimiento, observaciones y entrega de proyectos.','/garantias':'Etiquetas de equipos y solicitudes de garantía.','/inventario':'Stock, almacenes, tiendas y transferencias.','/entregas':tech?'Recibir tus materiales, registrar su uso y devolver sobrantes.':'Entregar materiales a técnicos y registrar devoluciones.','/gestion-tienda':'Publicar equipos y materiales en la tienda.','/caja':'Registrar cobros y conciliar trabajos.','/finanzas':'Balance, gastos y costos.','/comisiones':user.rol==='ADMIN'?'Porcentajes y comisiones del equipo.':'Consultar tus comisiones.','/personal':user.rol==='ADMIN'?'Asistencia, permisos y sueldos del equipo.':'Tu asistencia, permisos y sueldo.','/perfil':user.rol==='ADMIN'?'Usuarios, accesos y roles del equipo.':'Tus datos personales y preferencias.','/sucursales':'Configurar sucursales y ubicaciones.','/configuracion':'Configurar precios, tarifas y documentos.','/atencion':'Vista de atención al cliente y ventas.','/supervision':'Revisar medidas y supervisar trabajos.','/notificaciones':'Consultar tus avisos pendientes.','/ayuda':'Guías y ejemplos para aprender a usar Servigaz.','/agenda':'Consultar tus visitas y trabajos asignados.'};
  const actions:Record<string,string>={'/recepcion':'atender vender registrar ingreso nuevo cliente trabajo','/clientes':'buscar historial contacto','/cotizaciones':'cotizar presupuesto propuesta seguimiento vencidas','/cotizador':'calcular precio presupuesto','/inventario':'comprar compras stock reponer abastecer transferir','/entregas':'entregar material devolver tecnico','/caja':'cobrar pago pagos conciliar','/personal':'permiso justificar falta tardanza sueldo salario asistencia horario','/perfil':'perfil datos cuenta','/proyectos':'proyecto tramite aprobacion entidad','/garantias':'garantia reclamo etiqueta equipo'};
  const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  const terms=normalize(menuQuery.trim()).split(/\s+/).filter(Boolean);
  const matches=menu.filter(item=>item.show&&terms.every(term=>normalize(item.name+' '+(descriptions[item.href]||'')+' '+(actions[item.href]||'')+' '+(groups.find(g=>g.id===item.group)?.label||'')).includes(term)));
  const roles = roleLabels;
  return <>
    {open && <button type="button" className="sidebar-backdrop lg:hidden" onClick={onClose} aria-label="Cerrar menú" tabIndex={-1} />}
    <aside ref={ref} inert={mobile && !open} role={mobile && open ? "dialog" : undefined} aria-modal={mobile && open ? true : undefined} id="main-navigation" className={"app-sidebar" + (open ? " is-open" : "")} aria-label="Navegación principal">
      <div className="sidebar-brand">
        <Link href={roleHome(user.rol)} onClick={onClose} className="flex items-center gap-3"><div className="brand-mark"><Image src="/logo.jpg" alt="Servigaz" width={44} height={44} priority /></div><div><span className="block font-semibold text-lg tracking-tight text-white">SERVIGAZ<span className="text-orange-400">.</span></span><small>Gestión de servicios</small></div></Link>
        <button type="button" className="sidebar-close lg:hidden" onClick={onClose} aria-label="Cerrar menú"><X size={20} /></button>
      </div>
      <div className="px-5 pb-2"><RoleSwitcher/></div>
      <div className="px-4 pb-3"><label className="sr-only" htmlFor="menu-search">Buscar una herramienta</label><div className="sidebar-search"><Search size={16}/><input id="menu-search" type="search" autoComplete="off" maxLength={80} placeholder="Buscar herramienta…" value={menuQuery} onChange={e=>setMenuQuery(e.target.value)}/>{menuQuery&&<button type="button" aria-label="Limpiar búsqueda" onClick={()=>setMenuQuery('')}><X size={14}/></button>}</div></div>
      <nav className="sidebar-nav">
        {terms.length?<div className="sidebar-group"><p>RESULTADOS</p>{matches.length?matches.map(item=><Link key={item.href} href={item.href} onClick={onClose} className="sidebar-link !items-start"><item.icon size={18} className="shrink-0 mt-0.5"/><span><strong className="block text-xs font-medium">{item.name}</strong><small className="block text-[11px] text-slate-400 leading-relaxed mt-1">{descriptions[item.href]}</small></span></Link>):<div className="px-3 py-4 text-xs text-slate-400">No encontramos esa herramienta. Prueba con «clientes», «materiales» o «permisos».</div>}</div>:groups.map(group=>{const items=menu.filter(item=>item.show&&item.group===group.id);const current=items.some(item=>pathname===item.href||pathname.startsWith(item.href+'/'));const links=items.map(item=>{const active=pathname===item.href||pathname.startsWith(item.href+'/');return <Link key={item.href} href={item.href} onClick={onClose} aria-current={active?'page':undefined} className={'sidebar-link'+(active?' active':'')}><item.icon size={19} strokeWidth={1.7}/><span>{item.name}</span>{active&&<ChevronRight size={15} className="ml-auto"/>}</Link>;});if(!items.length)return null;return admin&&!['inicio','ayuda'].includes(group.id)?<details key={group.id+pathname} open={current} className="sidebar-section"><summary><span>{group.label}</span><ChevronRight size={15} className="sidebar-section-chevron"/></summary><div className="pt-1">{links}</div></details>:<div key={group.id} className="sidebar-group"><p>{group.label}</p>{links}</div>;})}
      </nav>
      <div className="sidebar-account">
        <div className="account-avatar" aria-hidden="true">{user.nombre.trim().split(/\s+/).slice(0,2).map(name => name[0]).join("")}</div>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{user.nombre}</p><span>{roles[user.rol]}</span></div>
        <button type="button" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={17} /></button>
      </div>
      <div className="sidebar-location"><MapPin size={12} /><span className="truncate">{store ? "Todas las tiendas" : user.sucursal || "Central Servigaz"}</span></div>
    </aside>
  </>;
}

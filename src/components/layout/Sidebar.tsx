"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {RoleSwitcher} from './RoleSwitcher';
import {roleLabels,roleHome} from "@/lib/user-roles";
import { LayoutDashboard, BriefcaseBusiness, Calculator, Users, Clock3, Package, Settings2, Award, LogOut, ChevronRight, MapPin, Wallet, X, Building2, CircleHelp, FolderClock, FileClock, ShoppingBag } from "lucide-react";

export function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const ref = useRef<HTMLElement>(null);
  const [mobile, setMobile] = useState(false);
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
    { name: "Tienda pública", href: "/gestion-tienda", icon: ShoppingBag, show: user.rol === "ADMIN", group: "gestion" },
    { name: "Sucursales y ubicaciones", href: "/sucursales", icon: Building2, show: manager, group: "gestion" },
    { name: store ? "Inventario de tiendas" : "Almacenes y tiendas", href: "/inventario", icon: Package, show: manager || store || warehouse, group: "gestion" },
    { name: "Finanzas", href: "/finanzas", icon: Wallet, show: user.rol === "ADMIN", group: "gestion" },
    { name: "Garantías", href: "/garantias", icon: Award, show: manager, group: "gestion" },
    { name: "Ayuda y práctica", href: "/ayuda", icon: CircleHelp, show: manager||tech, group: "gestion" },
    { name: user.rol === "ADMIN" ? "Usuarios y roles" : "Mi perfil", href: "/perfil", icon: Users, show: true, group: "gestion" },
    { name: user.rol === "ADMIN" ? "Personal, sueldos y asistencia" : "Mi personal y asistencia", href: "/personal", icon: Clock3, show: true, group: "gestion" },
    { name: "Precios y tarifas", href: "/configuracion", icon: Settings2, show: manager, group: "gestion" },
  ];
  const roles = roleLabels;
  return <>
    {open && <button type="button" className="sidebar-backdrop lg:hidden" onClick={onClose} aria-label="Cerrar menú" tabIndex={-1} />}
    <aside ref={ref} inert={mobile && !open} role={mobile && open ? "dialog" : undefined} aria-modal={mobile && open ? true : undefined} id="main-navigation" className={"app-sidebar" + (open ? " is-open" : "")} aria-label="Navegación principal">
      <div className="sidebar-brand">
        <Link href={roleHome(user.rol)} onClick={onClose} className="flex items-center gap-3"><div className="brand-mark"><Image src="/logo.jpg" alt="Servigaz" width={44} height={44} priority /></div><div><span className="block font-semibold text-lg tracking-tight text-white">SERVIGAZ<span className="text-orange-400">.</span></span><small>Gestión de servicios</small></div></Link>
        <button type="button" className="sidebar-close lg:hidden" onClick={onClose} aria-label="Cerrar menú"><X size={20} /></button>
      </div>
      <div className="px-5 pb-2"><RoleSwitcher/></div>
      <nav className="sidebar-nav">
        {[{ id: "principal", label: "ESPACIO DE TRABAJO" }, { id: "gestion", label: "GESTIÓN" }].map(group => <div key={group.id} className="sidebar-group">
          <p>{group.label}</p>
          {navigation.filter(item => item.show && item.group === group.id).map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return <Link key={item.href} href={item.href} onClick={onClose} aria-current={active ? "page" : undefined} className={"sidebar-link" + (active ? " active" : "")}><item.icon size={19} strokeWidth={1.7} /><span>{item.name}</span>{active && <ChevronRight size={15} className="ml-auto" />}</Link>;
          })}
        </div>)}
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

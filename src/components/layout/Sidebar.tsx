"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, BriefcaseBusiness, Calculator, Users, Clock3, Package, Settings2, Award, LogOut, ChevronRight, MapPin, Wallet, X, Building2, CircleHelp, FolderClock, Images } from "lucide-react";

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
  const manager = user.rol === "ADMIN" || user.rol === "ENCARGADO";
  const navigation = [
    { name: manager ? "Resumen" : "Mi agenda", href: manager ? "/dashboard" : "/agenda", icon: LayoutDashboard, show: true, group: "principal" },
    { name: manager ? "Trabajos y órdenes" : "Mis trabajos", href: "/trabajos", icon: BriefcaseBusiness, show: true, group: "principal" },
    { name: "Registro fotográfico", href: "/fotos", icon: Images, show: true, group: "principal" },
    { name: "Proyectos", href: "/proyectos", icon: FolderClock, show: manager, group: "principal" },
    { name: "Clientes", href: "/clientes", icon: Users, show: manager, group: "principal" },
    { name: "Cotizador", href: "/cotizador", icon: Calculator, show: manager, group: "principal" },
    { name: "Sucursales y ubicaciones", href: "/sucursales", icon: Building2, show: manager, group: "gestion" },
    { name: "Almacenes y tiendas", href: "/inventario", icon: Package, show: manager, group: "gestion" },
    { name: "Finanzas", href: "/finanzas", icon: Wallet, show: user.rol === "ADMIN", group: "gestion" },
    { name: "Garantías", href: "/garantias", icon: Award, show: manager, group: "gestion" },
    { name: "Ayuda y práctica", href: "/ayuda", icon: CircleHelp, show: true, group: "gestion" },
    { name: "Mi perfil", href: "/perfil", icon: Users, show: true, group: "gestion" },
    { name: "Asistencia", href: "/asistencia", icon: Clock3, show: true, group: "gestion" },
    { name: "Precios y tarifas", href: "/configuracion", icon: Settings2, show: manager, group: "gestion" },
  ];
  const roles = { ADMIN: "Administrador", ENCARGADO: "Encargado", TECNICO_FIJO: "Técnico" };
  return <>
    {open && <button type="button" className="sidebar-backdrop lg:hidden" onClick={onClose} aria-label="Cerrar menú" tabIndex={-1} />}
    <aside ref={ref} inert={mobile && !open} role={mobile && open ? "dialog" : undefined} aria-modal={mobile && open ? true : undefined} id="main-navigation" className={"app-sidebar" + (open ? " is-open" : "")} aria-label="Navegación principal">
      <div className="sidebar-brand">
        <Link href="/dashboard" onClick={onClose} className="flex items-center gap-3"><div className="brand-mark"><Image src="/logo.jpg" alt="Servigaz" width={44} height={44} priority /></div><div><span className="block font-semibold text-lg tracking-tight text-white">SERVIGAZ<span className="text-orange-400">.</span></span><small>Gestión de servicios</small></div></Link>
        <button type="button" className="sidebar-close lg:hidden" onClick={onClose} aria-label="Cerrar menú"><X size={20} /></button>
      </div>
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
      <div className="sidebar-location"><MapPin size={12} /><span className="truncate">{user.sucursal || "Central Servigaz"}</span></div>
    </aside>
  </>;
}

"use client";
import { useAuth } from "@/context/AuthContext";
import { Plus, Menu, Clock3, CircleHelp } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useHelp } from "@/components/help/HelpProvider";
import { ThemeToggle } from "./ThemeToggle";

export function Header({ title, onMenu }: { title?: string; onMenu?: () => void }) {
  const { user } = useAuth();
  const { openGuide } = useHelp();
  const pathname = usePathname();
  const sections: Record<string, string> = { recepcion:"Recepción en sucursal", atencion:"Atención al cliente y ventas", supervision:"Supervisión técnica", caja:"Caja y conciliación", proformas: "Proformas y solicitudes", entregas: "Entrega de material", cotizaciones: "Cotizaciones pendientes", "gestion-tienda": "Tienda pública", fotos: "Registro fotográfico", proyectos: "Proyectos de gas", agenda: "Mi agenda", perfil: "Mi perfil y equipo", ayuda: "Ayuda y práctica", dashboard: "Resumen general", trabajos: "Trabajos y órdenes", clientes: "Clientes", cotizador: "Cotizador", inventario: "Almacenes y tiendas", sucursales: "Sucursales y ubicaciones", garantias: "Garantías", configuracion: "Precios y tarifas", asistencia: "Asistencia", finanzas: "Finanzas" };
  return <header className="app-header">
    <div className="flex items-center gap-3 min-w-0">
      <button type="button" onClick={onMenu} className="theme-toggle mobile-menu-toggle" aria-label="Abrir menú" aria-controls="main-navigation"><Menu size={20} /></button>
      <div className="min-w-0">
        <p className="hidden sm:block text-[11px] text-muted mb-0.5">Tu espacio de trabajo</p>
        <h1 className="font-semibold text-sm sm:text-base text-ink truncate">{title || sections[pathname.split("/")[1]] || "Servigaz"}</h1>
      </div>
    </div>
    <div className="flex items-center gap-2 sm:gap-3">
      {["ADMIN","ENCARGADO","TECNICO_FIJO"].includes(user?.rol||"") && <button type="button" className="theme-toggle" aria-label="Abrir guía de ayuda" title="Ayuda y guía de bienvenida" onClick={openGuide}><CircleHelp size={18} /><span className="hidden lg:inline">Ayuda</span></button>}
      <ThemeToggle />
      {["ADMIN","ENCARGADO","TECNICO_FIJO"].includes(user?.rol||"") && <Link href="/asistencia" className="theme-toggle attendance-shortcut" title="Marcar asistencia"><Clock3 size={17} /><span>Asistencia</span></Link>}
      {(user?.rol === "ADMIN" || user?.rol === "ENCARGADO" || user?.rol === "VENTAS") &&
        <Link href="/trabajos/nuevo" className="primary-action"><Plus size={17} /><span className="hidden sm:inline">Nuevo trabajo</span><span className="sm:hidden">Nuevo</span></Link>}
    </div>
  </header>;
}

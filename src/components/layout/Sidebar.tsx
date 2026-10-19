"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  Briefcase,
  Calculator,
  Users,
  Clock,
  Package,
  Settings,
  ShieldAlert,
  Award,
  LogOut,
  Sparkles,
  ChevronRight,
  MapPin,
  DollarSign,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) return null;

  const isAdmin = user.rol === "ADMIN";
  const isEncargado = user.rol === "ENCARGADO";
  const isTecnico = user.rol === "TECNICO_FIJO";

  const navigation = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      show: true,
      badge: isAdmin ? "Admin" : isEncargado ? "Resumen" : "Mis Trabajos",
    },
    {
      name: "Trabajos y Órdenes",
      href: "/trabajos",
      icon: Briefcase,
      show: true,
    },
    {
      name: "Finanzas & Balance",
      href: "/finanzas",
      icon: DollarSign,
      show: isAdmin,
      badge: "Fase 19",
    },
    {
      name: "Cotizador Dinámico",
      href: "/cotizador",
      icon: Calculator,
      show: isAdmin || isEncargado,
      badge: "v12",
    },
    {
      name: "Clientes",
      href: "/clientes",
      icon: Users,
      show: isAdmin || isEncargado,
    },
    {
      name: "Control Asistencia",
      href: "/asistencia",
      icon: Clock,
      show: true,
      badge: "Fase 18",
    },
    {
      name: "Inventario & Stock",
      href: "/inventario",
      icon: Package,
      show: isAdmin || isEncargado,
    },
    {
      name: "Garantías & Reclamos",
      href: "/garantias",
      icon: Award,
      show: isAdmin || isEncargado,
    },
    {
      name: "Precios & Tarifas",
      href: "/configuracion",
      icon: Settings,
      show: isAdmin || isEncargado,
      badge: isAdmin ? "Editor" : "Lectura",
    },
    {
      name: "Auditoría del Sistema",
      href: "/auditoria",
      icon: ShieldAlert,
      show: isAdmin,
      badge: "Inalterable",
    },
  ];

  const roleColors = {
    ADMIN: "bg-purple-100 text-purple-800 border-purple-200",
    ENCARGADO: "bg-[#F06529]/15 text-[#D94E15] border-[#F06529]/30",
    TECNICO_FIJO: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };

  const roleLabels = {
    ADMIN: "Administrador",
    ENCARGADO: "Encargado General",
    TECNICO_FIJO: "Técnico Fijo",
  };

  return (
    <aside className="w-64 bg-[#0F2C59] text-white flex flex-col h-screen sticky top-0 shadow-xl border-r border-[#1A3E72] z-30">
      {/* Brand Logo Header */}
      <div className="p-4 border-b border-[#1A3E72]/70 bg-[#0A1F3F]/50 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="relative w-36 h-14">
            <Image
              src="/logo.jpg"
              alt="Servigaz"
              fill
              className="object-contain"
              priority
            />
          </div>
        </Link>
      </div>

      {/* User Info Card */}
      <div className="p-4 border-b border-[#1A3E72]/50 bg-[#133E68]/30">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-slate-200 truncate block max-w-[140px]">
            {user.nombre}
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleColors[user.rol]}`}
          >
            {roleLabels[user.rol]}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-300">
          <MapPin className="h-3 w-3 text-[#F06529]" />
          <span className="truncate">{user.sucursal || "Central Servigaz"}</span>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-2">
          Módulos Operativos
        </div>

        {navigation
          .filter((item) => item.show)
          .map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                  isActive
                    ? "bg-[#F06529] text-white shadow-md font-bold"
                    : "text-slate-200 hover:bg-[#1A3E72] hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 transition-transform group-hover:scale-110 ${
                      isActive ? "text-white" : "text-slate-300 group-hover:text-white"
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${
                      isActive
                        ? "bg-black/20 text-white"
                        : "bg-[#1A3E72] text-slate-300"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
      </nav>

      <div className="p-3 bg-[#0A1F3F] border-t border-[#1A3E72]">
        <button
          onClick={logout}
          className="w-full mt-3 py-2 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-red-500/20"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}

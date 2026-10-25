"use client";

import { PendingQuotes } from "@/components/PendingQuotes";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Users,
  Package,
  Clock,
  TrendingUp,
  AlertTriangle,
  PlusCircle,
  Calculator,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Sparkles,
  Flame,
  Thermometer,
  Wrench,
  ClipboardCheck,
} from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    if (user.rol === "TECNICO_FIJO") { router.replace("/agenda"); return; }
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user?.id, user?.rol, router]);

  const isAdmin = user?.rol === "ADMIN";
  const isEncargado = user?.rol === "ENCARGADO";
  const isTecnico = user?.rol === "TECNICO_FIJO";

  if (isTecnico) return <p className="module-note">Abriendo tu agenda… <Link className="underline" href="/agenda">Ir a mi agenda</Link></p>;
  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="dashboard-hero text-white relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-56 h-56 bg-[#F06529]/20 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold text-[#FF7B42] mb-2 border border-white/10">
              <Sparkles className="h-3 w-3" />
              <span>Tu operación, en un vistazo</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              ¡Hola, {user?.nombre}!
            </h2>
            <p className="text-slate-200 text-xs sm:text-sm mt-1 max-w-xl">
              {isAdmin && "Centro de control general: tarifas, reglas comerciales, cotizaciones y rentabilidad."}
              {isEncargado && "Gestión de trabajos de clientes, cotizaciones automáticas y seguimiento en terreno."}
              {isTecnico && "Visitas técnicas asignadas, ejecución en terreno y marcación diaria de asistencia."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {(isAdmin || isEncargado) && (
              <Link
                href="/cotizador"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F06529] hover:bg-[#D94E15] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <Calculator className="h-4 w-4" />
                <span>Abrir Cotizador</span>
              </Link>
            )}
            <Link
              href="/trabajos/nuevo"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface text-ink hover:bg-wash text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <PlusCircle className="h-4 w-4 text-[#F06529]" />
              <span>Nuevo Trabajo</span>
            </Link>
          </div>
        </div>
      </div>

      <PendingQuotes compact />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Trabajos Activos */}
        <div className="bg-surface p-5 rounded-2xl shadow-xs border border-line flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted uppercase tracking-wider">
              Trabajos en Curso
            </p>
            <h3 className="text-2xl font-black text-ink mt-1">
              {data?.metrics?.trabajosActivos ?? 0}
            </h3>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-300 flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Operación activa
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-ink">
            <Briefcase className="h-6 w-6" />
          </div>
        </div>

        {/* Card 2: Clientes */}
        <div className="bg-surface p-5 rounded-2xl shadow-xs border border-line flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted uppercase tracking-wider">
              Clientes Registrados
            </p>
            <h3 className="text-2xl font-black text-ink mt-1">
              {data?.metrics?.totalClientes ?? 0}
            </h3>
            <span className="text-[11px] font-medium text-muted mt-0.5 block">
              Base de clientes
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-100 dark:border-orange-900 flex items-center justify-center text-[#F06529]">
            <Users className="h-6 w-6" />
          </div>
        </div>

        {/* Card 3: Stock */}
        <div className="bg-surface p-5 rounded-2xl shadow-xs border border-line flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted uppercase tracking-wider">
              Materiales & Stock
            </p>
            <h3 className="text-2xl font-black text-ink mt-1">
              {data?.metrics?.totalProductos ?? 0}
            </h3>
            <span className="text-[11px] font-medium text-muted mt-0.5 block">
              Catálogo de inventario
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900 flex items-center justify-center text-purple-700 dark:text-purple-300">
            <Package className="h-6 w-6" />
          </div>
        </div>

        {/* Card 4: Asistencia */}
        <div className="bg-surface p-5 rounded-2xl shadow-xs border border-line flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted uppercase tracking-wider">
              Asistencia Hoy
            </p>
            <h3 className="text-2xl font-black text-ink mt-1">
              {data?.metrics?.asistenciasHoy ?? 0}
            </h3>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-300 flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="h-3 w-3" />
              Personal Registrado
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
            <Clock className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Main Content Grid: Categorías de Servicio + Trabajos Recientes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Categorías de Servicio */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-surface p-5 rounded-2xl shadow-xs border border-line">
            <h4 className="text-sm font-black text-ink uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#F06529]" />
              Servicios Principales Servigaz
            </h4>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl border border-orange-100 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/40 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Flame className="h-4 w-4 text-[#F06529]" />
                  <div>
                    <h5 className="font-bold text-ink">Instalaciones de Gas</h5>
                    <p className="text-[11px] text-muted">Nuevas, modificaciones, SEC</p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-blue-100 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/40 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Thermometer className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                  <div>
                    <h5 className="font-bold text-ink">Calefacción & Clima</h5>
                    <p className="text-[11px] text-muted">Radiadores y Piso Radiante</p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-purple-100 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/40 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Wrench className="h-4 w-4 text-purple-600 dark:text-purple-300" />
                  <div>
                    <h5 className="font-bold text-ink">Equipos & Calderas</h5>
                    <p className="text-[11px] text-muted">Montaje y Mantención</p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-amber-100 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/40 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ClipboardCheck className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                  <div>
                    <h5 className="font-bold text-ink">Otros Servicios & Trámites</h5>
                    <p className="text-[11px] text-muted">Hermeticidad, medidores, arriendo</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#0F2C59] to-[#1A3E72] p-5 rounded-2xl text-white shadow-md">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#FF7B42] mb-1">
              Cotizador Inteligente
            </h4>
            <p className="text-xs text-slate-200 mb-4">
              Crea presupuestos combinando instalaciones, pruebas y venta de insumos.
            </p>
            <Link
              href="/cotizador"
              className="w-full py-2.5 px-4 bg-[#F06529] hover:bg-[#D94E15] rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer text-white"
            >
              <span>Generar Presupuesto</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Right Column: Trabajos Recientes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-surface p-5 rounded-2xl shadow-xs border border-line">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-black text-ink uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-[#F06529]" />
                Órdenes de Trabajo Recientes
              </h4>
              <Link
                href="/trabajos"
                className="text-xs font-bold text-[#F06529] hover:underline flex items-center gap-1"
              >
                <span>Ver todos</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {data?.ultimosTrabajos?.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-line rounded-xl">
                <Briefcase className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-secondary">No hay trabajos creados aún</p>
                <Link
                  href="/trabajos/nuevo"
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0F2C59] text-white rounded-lg text-xs font-bold"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Crear Trabajo Ahora
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {data?.ultimosTrabajos?.map((trb: any) => (
                  <Link
                    key={trb.id}
                    href={`/trabajos/${trb.id}`}
                    className="py-3 flex items-center justify-between hover:bg-canvas px-2 rounded-xl transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-ink">
                          {trb.codigoCorrelativo}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-wash text-secondary">
                          {trb.subtipoNombre}
                        </span>
                      </div>
                      <p className="text-xs text-secondary font-medium mt-0.5">
                        Cliente: {trb.cliente?.nombreCompleto}
                      </p>
                    </div>

                    <div className="text-right flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                        {trb.estado}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-faint" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

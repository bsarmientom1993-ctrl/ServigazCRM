"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Briefcase,
  PlusCircle,
  Search,
  Flame,
  Thermometer,
  Wrench,
  Droplets,
  ClipboardCheck,
  ShoppingBag,
  ChevronRight,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
} from "lucide-react";

export default function TrabajosPage() {
  const [trabajos, setTrabajos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("TODOS");
  const [tabEstado, setTabEstado] = useState<"PENDIENTES" | "FINALIZADOS" | "CANCELADOS" | "TODOS">("PENDIENTES");

  useEffect(() => {
    fetch("/api/trabajos")
      .then((r) => r.json())
      .then((data) => {
        setTrabajos(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const estadoBadge: Record<string, { label: string; color: string }> = {
    BORRADOR: { label: "📝 Borrador", color: "bg-slate-100 text-slate-700 border-slate-200" },
    EVALUACION_PENDIENTE: { label: "📏 Medición Pendiente", color: "bg-blue-50 text-blue-800 border-blue-200" },
    EVALUADO: { label: "⏳ Por Presupuestar", color: "bg-indigo-50 text-indigo-800 border-indigo-200" },
    COTIZADO: { label: "📄 Esperando al Cliente", color: "bg-purple-50 text-purple-800 border-purple-200" },
    APROBADO: { label: "🤝 Aprobado (Falta Anticipo)", color: "bg-amber-50 text-amber-800 border-amber-200" },
    ANTICIPO_RECIBIDO: { label: "💵 Anticipo Pagado", color: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    EN_PROCESO: { label: "⚡ En Ejecución / Trabajo en Curso", color: "bg-orange-50 text-orange-800 border-orange-200 animate-pulse" },
    TERMINADO_TECNICO: { label: "🏁 Físico Terminado", color: "bg-sky-50 text-sky-800 border-sky-200" },
    VALIDADO: { label: "✅ Calidad Aprobada", color: "bg-teal-50 text-teal-800 border-teal-200" },
    FINALIZADO_FINANCIERO: { label: "🎉 Finalizado con Garantía", color: "bg-green-100 text-green-900 border-green-300 font-black" },
    RECHAZADO: { label: "Rechazado", color: "bg-red-50 text-red-800 border-red-200" },
    PAGO_A_CUENTA_RECIBIDO: { label: "Anticipo parcial", color: "bg-amber-50 text-amber-800 border-amber-200" },
    CANCELADO: { label: "❌ Cancelado", color: "bg-red-50 text-red-800 border-red-200" },
    ARCHIVADO: { label: "📁 Archivado", color: "bg-slate-100 text-slate-500 border-slate-200" },
  };

  const getServiceIcon = (nombre: string = "") => {
    if (nombre.toLowerCase().includes("gas")) return Flame;
    if (nombre.toLowerCase().includes("calefac") || nombre.toLowerCase().includes("radiad") || nombre.toLowerCase().includes("piso")) return Thermometer;
    if (nombre.toLowerCase().includes("plomer") || nombre.toLowerCase().includes("agua")) return Droplets;
    if (nombre.toLowerCase().includes("equipo") || nombre.toLowerCase().includes("caldera") || nombre.toLowerCase().includes("calef")) return Wrench;
    if (nombre.toLowerCase().includes("hermeticidad") || nombre.toLowerCase().includes("ensayo") || nombre.toLowerCase().includes("medidor")) return ClipboardCheck;
    return ShoppingBag;
  };

  // Contadores
  const pendientesCount = trabajos.filter(
    (t) => !["FINALIZADO_FINANCIERO", "CANCELADO", "RECHAZADO", "ARCHIVADO"].includes(t.estado)
  ).length;

  const finalizadosCount = trabajos.filter(
    (t) => ["FINALIZADO_FINANCIERO", "ARCHIVADO"].includes(t.estado)
  ).length;

  const canceladosCount = trabajos.filter((t) => ["CANCELADO", "RECHAZADO"].includes(t.estado)).length;

  const filtered = trabajos.filter((t) => {
    // 1. Filtro por Pestaña de Estado
    if (tabEstado === "PENDIENTES" && ["FINALIZADO_FINANCIERO", "CANCELADO", "RECHAZADO", "ARCHIVADO"].includes(t.estado)) {
      return false;
    }
    if (tabEstado === "FINALIZADOS") {
      if (!["FINALIZADO_FINANCIERO", "ARCHIVADO"].includes(t.estado)) return false;
    }
    if (tabEstado === "CANCELADOS" && !["CANCELADO", "RECHAZADO"].includes(t.estado)) {
      return false;
    }

    // 2. Filtro de búsqueda
    const matchQuery =
      t.codigoCorrelativo?.toLowerCase().includes(busqueda.toLowerCase()) ||
      t.cliente?.nombreCompleto?.toLowerCase().includes(busqueda.toLowerCase()) ||
      t.subtipoNombre?.toLowerCase().includes(busqueda.toLowerCase());

    // 3. Filtro por Categoría
    if (filtroCategoria === "TODOS") return matchQuery;
    const matchCat = t.subtipoNombre?.toLowerCase().includes(filtroCategoria.toLowerCase());
    return matchQuery && matchCat;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-[#0F2C59] tracking-tight flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-[#F06529]" />
            Órdenes de Trabajo & Servicios
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Las órdenes activas permanecen como <strong>Pendientes</strong> hasta que se completen o cancelen.
          </p>
        </div>

        <Link
          href="/trabajos/nuevo"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#F06529] hover:bg-[#D94E15] text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer"
        >
          <PlusCircle className="h-4 w-4" />
          <span>+ Nueva Orden de Trabajo</span>
        </Link>
      </div>

      {/* Pestañas Principales de Estado (Pendientes / Finalizados / Rechazados / Cancelados) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1 overflow-x-auto">
        <button
          onClick={() => setTabEstado("PENDIENTES")}
          className={`px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            tabEstado === "PENDIENTES"
              ? "bg-[#0F2C59] text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Clock className="h-4 w-4 text-[#F06529]" />
          <span>⏳ Órdenes Pendientes / En Curso</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            tabEstado === "PENDIENTES" ? "bg-amber-400 text-slate-900" : "bg-slate-200 text-slate-700"
          }`}>
            {pendientesCount}
          </span>
        </button>

        <button
          onClick={() => setTabEstado("FINALIZADOS")}
          className={`px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            tabEstado === "FINALIZADOS"
              ? "bg-emerald-700 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          <span>✅ Finalizadas (Garantía Activa)</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            tabEstado === "FINALIZADOS" ? "bg-white text-emerald-900" : "bg-slate-200 text-slate-700"
          }`}>
            {finalizadosCount}
          </span>
        </button>

        <button
          onClick={() => setTabEstado("CANCELADOS")}
          className={`px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            tabEstado === "CANCELADOS"
              ? "bg-red-700 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <XCircle className="h-4 w-4 text-red-300" />
          <span>❌ Canceladas</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            tabEstado === "CANCELADOS" ? "bg-white text-red-900" : "bg-slate-200 text-slate-700"
          }`}>
            {canceladosCount}
          </span>
        </button>

        <button
          onClick={() => setTabEstado("TODOS")}
          className={`px-3 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
            tabEstado === "TODOS"
              ? "bg-slate-800 text-white"
              : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Ver Todas ({trabajos.length})
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por código, cliente o servicio..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#F06529]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {[
            { id: "TODOS", label: "Todos los servicios" },
            { id: "gas", label: "🔥 Gas" },
            { id: "calefac", label: "❄️ Calefacción" },
            { id: "plomer", label: "💧 Plomería" },
            { id: "equipo", label: "🛠️ Equipos / Calefón" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFiltroCategoria(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                filtroCategoria === cat.id
                  ? "bg-[#0F2C59] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 font-semibold">
            Cargando órdenes de trabajo...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-700">
              {tabEstado === "PENDIENTES"
                ? "No hay órdenes pendientes en este momento"
                : "No se encontraron trabajos con los filtros actuales"}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {tabEstado === "PENDIENTES"
                ? "Todos los trabajos han sido completados o no se han creado nuevas solicitudes."
                : "Intenta cambiar la búsqueda o el filtro de servicio."}
            </p>
            <Link
              href="/trabajos/nuevo"
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#F06529] text-white text-xs font-bold rounded-xl hover:bg-[#D94E15] transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              Crear Nueva Orden
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((t) => {
              const Icon = getServiceIcon(t.subtipoNombre);
              const badge = estadoBadge[t.estado] || { label: t.estado, color: "bg-slate-100 text-slate-700 border-slate-200" };
              return (
                <div
                  key={t.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-[#0F2C59] shrink-0 mt-0.5">
                      <Icon className="h-5 w-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-[#0F2C59]">
                          {t.codigoCorrelativo}
                        </span>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {t.subtipoNombre}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-slate-800 mt-1">
                        {t.cliente?.nombreCompleto}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {t.cliente?.direccion || "Sin dirección registrada"}
                        </span>
                        {t.tecnico && (
                          <span>• Técnico: <strong>{t.tecnico.nombre}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${badge.color}`}>
                      {badge.label}
                    </span>

                    <Link
                      href={`/trabajos/${t.id}`}
                      className="px-4 py-2 rounded-xl bg-[#0F2C59] hover:bg-[#1A3E72] text-white transition-colors flex items-center gap-1 text-xs font-bold shadow-xs cursor-pointer"
                      title="Ver Detalle y Gestionar Trabajo"
                    >
                      <span>Gestionar</span>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

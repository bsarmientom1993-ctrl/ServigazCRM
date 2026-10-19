"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  FileText,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  TrendingDown,
  Sparkles,
} from "lucide-react";

export default function AsistenciaPage() {
  const { user } = useAuth();
  const isAdmin = user?.rol === "ADMIN";

  const [entradaMarcada, setEntradaMarcada] = useState<string | null>("08:24");
  const [salidaMarcada, setSalidaMarcada] = useState<string | null>(null);
  const [estadoHoy, setEstadoHoy] = useState<string>("PRESENTE");

  const [permisoData, setPermisoData] = useState({
    fecha: "",
    motivo: "Médico",
    descripcion: "",
    comprobante: "",
  });

  const [mensaje, setMensaje] = useState("");

  const marcarEntrada = () => {
    const hora = new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    setEntradaMarcada(hora);
    setEstadoHoy("PRESENTE");
    setMensaje("✅ Entrada registrada exitosamente a las " + hora);
  };

  const marcarSalida = () => {
    if (!entradaMarcada) {
      setMensaje("❌ Bloqueo Fase 18: No puede registrar salida sin haber marcado entrada.");
      return;
    }
    const hora = new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    setSalidaMarcada(hora);
    setMensaje("✅ Salida registrada exitosamente a las " + hora);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface p-5 rounded-2xl border border-line shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-ink tracking-tight flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#F06529]" />
            Control de Personal & Asistencia (Fase 18)
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Registro diario de entrada/salida, tolerancia 15m, cálculo automático de tardanzas y gestión de permisos.
          </p>
        </div>

        <span className="text-xs font-bold px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 rounded-full">
          Horario: 08:30 - 18:00
        </span>
      </div>

      {mensaje && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl text-xs font-semibold text-blue-800 dark:text-blue-300">
          {mensaje}
        </div>
      )}

      {/* Main Grid: Clock-in Terminal on Left, Permission & Rules on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Clock-in Terminal (6 cols) */}
        <div className="lg:col-span-6 space-y-5">
          <div className="bg-surface p-6 rounded-2xl border border-line shadow-xs text-center space-y-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-faint">
              Terminal de Marcación Diaria
            </span>

            <div className="p-4 bg-canvas rounded-2xl border border-line-soft max-w-xs mx-auto">
              <p className="text-xs text-muted font-medium">Estado de Hoy:</p>
              <div className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-black text-sm">
                <CheckCircle2 className="h-4 w-4" />
                {estadoHoy}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto pt-2">
              <button
                type="button"
                onClick={marcarEntrada}
                className="p-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex flex-col items-center gap-1 transition-all cursor-pointer"
              >
                <Clock className="h-5 w-5" />
                <span>Marcar Entrada</span>
                <span className="text-[10px] text-emerald-100 font-normal">
                  {entradaMarcada ? `Registrada: ${entradaMarcada}` : "Pendiente"}
                </span>
              </button>

              <button
                type="button"
                onClick={marcarSalida}
                className="p-4 rounded-xl bg-[#0F2C59] hover:bg-[#1A3E72] text-white font-bold text-xs shadow-md flex flex-col items-center gap-1 transition-all cursor-pointer"
              >
                <Clock className="h-5 w-5 text-amber-400" />
                <span>Marcar Salida</span>
                <span className="text-[10px] text-slate-300 font-normal">
                  {salidaMarcada ? `Registrada: ${salidaMarcada}` : "Pendiente"}
                </span>
              </button>
            </div>

            <div className="text-[11px] text-muted pt-3 border-t border-line-soft">
              🔒 <strong>Regla #90:</strong> Bloqueos automáticos ante doble entrada o salida sin entrada previa.
            </div>
          </div>

          {/* Attendance History */}
          <div className="bg-surface p-5 rounded-2xl border border-line shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary mb-3 flex items-center justify-between">
              <span>Registro de la Semana</span>
              <span className="text-[10px] text-faint">Tolerancia: 15 min</span>
            </h3>

            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-ink">Hoy (30 Ago)</p>
                  <p className="text-[11px] text-muted">Entrada: 08:24 • Salida: --:--</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
                  Presente (A tiempo)
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-ink">Viernes (28 Ago)</p>
                  <p className="text-[11px] text-muted">Entrada: 08:28 • Salida: 18:05</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
                  Presente
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-ink">Jueves (27 Ago)</p>
                  <p className="text-[11px] text-muted">Entrada: 08:48 • Salida: 18:00</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold text-[10px]">
                  Tardanza (-25% día)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Solicitud de Permisos & Reglas de Descuento (6 cols) */}
        <div className="lg:col-span-6 space-y-5">
          {/* Formulario Permisos */}
          <div className="bg-surface p-5 rounded-2xl border border-line shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-[#F06529]" />
              Solicitud de Permiso (Máx 2 al mes)
            </h3>

            <div>
              <label className="block text-xs font-bold text-secondary mb-1">Fecha del Permiso</label>
              <input
                type="date"
                className="w-full p-2 bg-canvas border border-line rounded-xl text-xs font-semibold outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-secondary mb-1">Motivo</label>
              <select className="w-full p-2 bg-canvas border border-line rounded-xl text-xs font-semibold outline-none">
                <option value="medico">Atención Médica / Exámenes</option>
                <option value="tramite">Trámite Personal Impostergable</option>
                <option value="familiar">Fuerza Mayor / Familiar</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-secondary mb-1">
                Comprobante / Justificación (OBLIGATORIO)
              </label>
              <input
                type="file"
                className="w-full p-2 bg-canvas border border-line rounded-xl text-xs text-secondary outline-none"
              />
            </div>

            <button
              type="button"
              className="w-full py-2.5 px-4 bg-[#0F2C59] hover:bg-[#1A3E72] text-white font-bold rounded-xl text-xs shadow-sm transition-all cursor-pointer"
            >
              Enviar a Aprobación de Administración
            </button>
          </div>

          {/* Tabla de Descuentos Automáticos */}
          <div className="bg-surface p-5 rounded-2xl border border-line shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary mb-2 flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Tabla de Descuentos Automáticos (#90)
            </h3>

            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-line text-faint">
                  <th className="py-2">Evento</th>
                  <th className="py-2">Cálculo Descuento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-secondary">
                <tr>
                  <td className="py-2 font-bold text-red-600 dark:text-red-300">Falta Injustificada</td>
                  <td className="py-2">Sueldo Día × 100%</td>
                </tr>
                <tr>
                  <td className="py-2 font-bold text-amber-600 dark:text-amber-300">Tardanza (&gt;15 min)</td>
                  <td className="py-2">Sueldo Día × 25%</td>
                </tr>
                <tr>
                  <td className="py-2 font-bold text-blue-600 dark:text-blue-300">Permiso Aprobado</td>
                  <td className="py-2">Sin descuento (Justificado)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

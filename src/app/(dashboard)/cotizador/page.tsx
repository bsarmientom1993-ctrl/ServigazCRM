"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Calculator,
  Flame,
  Thermometer,
  Wrench,
  Droplets,
  ShoppingBag,
  ClipboardCheck,
  AlertTriangle,
  UserPlus,
  FileText,
  DollarSign,
  Percent,
  CheckCircle,
  Sparkles,
} from "lucide-react";

export default function CotizadorPage() {
  const { user } = useAuth();
  const isAdmin = user?.rol === "ADMIN";

  // Módulos Combinados Activos
  const [serviciosActivos, setServiciosActivos] = useState<string[]>(["GAS", "OFICINA_TRAMITES"]);
  const [dificultadNivel, setDificultadNivel] = useState(1);
  const [porcentajeDescuento, setPorcentajeDescuento] = useState(0);

  // Datos de los formularios (en Bolivianos Bs.)
  const [formData, setFormData] = useState<any>({
    // Gas
    gasMedidores: 1,
    gasIncluyeProyecto: true,
    gasMetrosVisto: 10,
    gasMetrosEmpotrado: 6,
    // Calefacción
    calefaccionTipo: "RADIADORES",
    calMetrosTubo: 20,
    calCantRadiadores: 4,
    calPrecioRadiador: 450,
    calM2Piso: 60,
    // Plomería
    plomeriaPuntosAgua: 2,
    // Equipos
    equiposNombre: "Caldera Mural Mixta 24kW",
    equiposPrecio: 4800,
    equiposManoObra: 450,
    // Ensayos & Otros
    oficinaTipo: "HERMETICIDAD",
    alquilerDias: 2,
    alquilerTarifaDia: 120,
    // Tienda
    tiendaMaterialesTotal: 250,
    // Logística
    transporte: 150,
  });

  const [calculo, setCalculo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const recalcular = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cotizador/calcular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviciosActivos,
          formData,
          dificultadNivel,
          porcentajeDescuento,
        }),
      });
      const data = await res.json();
      setCalculo(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    recalcular();
  }, [serviciosActivos, dificultadNivel, porcentajeDescuento, formData]);

  const toggleServicio = (id: string) => {
    setServiciosActivos((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== id);
      }
      return [...prev, id];
    });
  };

  const handleInputChange = (field: string, val: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: val }));
  };

  const serviciosDisponibles = [
    { id: "GAS", label: "🔥 Gas (Red / Planos)", icon: Flame },
    { id: "CALEFACCION", label: "❄️ Calefacción (Rad / Piso)", icon: Thermometer },
    { id: "PLOMERIA", label: "💧 Plomería & Sanitaria", icon: Droplets },
    { id: "EQUIPOS", label: "🛠️ Equipos & Calderas", icon: Wrench },
    { id: "OFICINA_TRAMITES", label: "📋 Otros Servicios (Hermeticidad / Medidores)", icon: ClipboardCheck },
    { id: "TIENDA", label: "📦 Tienda & Insumos", icon: ShoppingBag },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-[#0F2C59] tracking-tight flex items-center gap-2">
            <Calculator className="h-5 w-5 text-[#F06529]" />
            Cotizador Modular Integral (Bolivianos - Bs.)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Presupuesta instalaciones de gas, calefacción, calderas, pruebas de hermeticidad y arriendo de herramientas en moneda nacional (Bs.).
          </p>
        </div>

        <span className="text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5" /> Moneda: Bolivianos (Bs.)
        </span>
      </div>

      {/* Selector de Módulos */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
          1. Marca los servicios que integran el presupuesto:
        </label>

        <div className="flex flex-wrap gap-2">
          {serviciosDisponibles.map((s) => {
            const isSelected = serviciosActivos.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleServicio(s.id)}
                className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? "border-[#0F2C59] bg-[#0F2C59] text-white shadow-sm"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>{s.label}</span>
                {isSelected && <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Forms (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* MÓDULO GAS */}
          {serviciosActivos.includes("GAS") && (
            <div className="bg-white p-5 rounded-2xl border border-orange-200 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#F06529] flex items-center gap-1.5 border-b border-orange-100 pb-2">
                <Flame className="h-4 w-4" /> Módulo de Instalación de Gas
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Gabinete de Medidores</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.gasMedidores}
                    onChange={(e) => handleInputChange("gasMedidores", e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Bs. 350 / medidor</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Proyecto y Planos Gas</label>
                  <select
                    value={formData.gasIncluyeProyecto ? "SI" : "NO"}
                    onChange={(e) => handleInputChange("gasIncluyeProyecto", e.target.value === "SI")}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none"
                  >
                    <option value="SI">Incluir Proyecto y Planos (Bs. 650)</option>
                    <option value="NO">Sin Proyecto (Solo Trazado)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Metros Tubo Visto (m)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.gasMetrosVisto}
                    onChange={(e) => handleInputChange("gasMetrosVisto", e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Bs. 85 / metro</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Metros Tubo Empotrado (m)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.gasMetrosEmpotrado}
                    onChange={(e) => handleInputChange("gasMetrosEmpotrado", e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Bs. 125 / metro</span>
                </div>
              </div>
            </div>
          )}

          {/* MÓDULO OTROS SERVICIOS */}
          {serviciosActivos.includes("OFICINA_TRAMITES") && (
            <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-700 flex items-center gap-1.5 border-b border-amber-100 pb-2">
                <ClipboardCheck className="h-4 w-4" /> Módulo de Otros Servicios & Ensayos
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipo de Servicio Técnico</label>
                  <select
                    value={formData.oficinaTipo}
                    onChange={(e) => handleInputChange("oficinaTipo", e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none"
                  >
                    <option value="HERMETICIDAD">Prueba de Hermeticidad Manométrica (Bs. 280)</option>
                    <option value="CAMBIO_MEDIDOR">Cambio / Reemplazo de Medidor (Bs. 320)</option>
                    <option value="ALQUILER_HERRAMIENTAS">Alquiler de Herramientas Especiales</option>
                  </select>
                </div>

                {formData.oficinaTipo === "ALQUILER_HERRAMIENTAS" && (
                  <>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Días de Arriendo</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.alquilerDias}
                        onChange={(e) => handleInputChange("alquilerDias", e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Tarifa Diaria (Bs.)</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.alquilerTarifaDia}
                        onChange={(e) => handleInputChange("alquilerTarifaDia", e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* MÓDULO CALEFACCIÓN */}
          {serviciosActivos.includes("CALEFACCION") && (
            <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-blue-600 flex items-center gap-1.5 border-b border-blue-100 pb-2">
                <Thermometer className="h-4 w-4" /> Módulo de Calefacción
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipo de Sistema</label>
                  <select
                    value={formData.calefaccionTipo}
                    onChange={(e) => handleInputChange("calefaccionTipo", e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none"
                  >
                    <option value="RADIADORES">Radiadores de Agua (PPR / PEX)</option>
                    <option value="PISO">Piso Radiante (Losa)</option>
                  </select>
                </div>

                {formData.calefaccionTipo === "RADIADORES" ? (
                  <>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Metros Tuberías (m)</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.calMetrosTubo}
                        onChange={(e) => handleInputChange("calMetrosTubo", e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Cantidad Radiadores</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.calCantRadiadores}
                        onChange={(e) => handleInputChange("calCantRadiadores", e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Superficie Piso (m²)</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.calM2Piso}
                      onChange={(e) => handleInputChange("calM2Piso", e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MÓDULO PLOMERÍA */}
          {serviciosActivos.includes("PLOMERIA") && (
            <div className="bg-white p-5 rounded-2xl border border-cyan-200 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-cyan-700 flex items-center gap-1.5 border-b border-cyan-100 pb-2">
                <Droplets className="h-4 w-4" /> Módulo de Plomería & Sanitaria
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Puntos de Agua / Conexiones</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.plomeriaPuntosAgua}
                    onChange={(e) => handleInputChange("plomeriaPuntosAgua", e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Bs. 330 / punto completo</span>
                </div>
              </div>
            </div>
          )}

          {/* MÓDULO EQUIPOS */}
          {serviciosActivos.includes("EQUIPOS") && (
            <div className="bg-white p-5 rounded-2xl border border-purple-200 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-purple-700 flex items-center gap-1.5 border-b border-purple-100 pb-2">
                <Wrench className="h-4 w-4" /> Módulo de Equipos & Calderas
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nombre / Modelo Equipo</label>
                  <input
                    type="text"
                    value={formData.equiposNombre}
                    onChange={(e) => handleInputChange("equiposNombre", e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Precio Provisión Equipo (Bs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.equiposPrecio}
                    onChange={(e) => handleInputChange("equiposPrecio", e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* MÓDULO TIENDA */}
          {serviciosActivos.includes("TIENDA") && (
            <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1.5 border-b border-emerald-100 pb-2">
                <ShoppingBag className="h-4 w-4" /> Módulo Venta de Tienda / Insumos
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Total Insumos Mostrador (Bs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.tiendaMaterialesTotal}
                    onChange={(e) => handleInputChange("tiendaMaterialesTotal", e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Dificultad */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Dificultad General del Trabajo
              </label>
              <span className="text-xs font-black text-[#F06529]">
                Nivel {dificultadNivel} (x{calculo?.factorDificultad || "1.0"})
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setDificultadNivel(lvl)}
                  className={`py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    dificultadNivel === lvl
                      ? "bg-[#0F2C59] text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Nivel {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Summary (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-gradient-to-br from-slate-900 via-[#0F2C59] to-slate-950 text-white p-6 rounded-2xl shadow-xl sticky top-20 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-xs font-bold text-[#FF7B42] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Presupuesto Unificado ({serviciosActivos.length} Servicios)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-emerald-300">
                Bs. (BOB)
              </span>
            </div>

            {/* Desglose */}
            <div className="space-y-2 text-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Desglose por Servicio:
              </p>
              {calculo?.itemsDesglose?.map((item: any, idx: number) => (
                <div key={idx} className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <div className="flex justify-between font-bold text-slate-200">
                    <span>{item.modulo}</span>
                    <span>Bs. {(item.materiales + item.manoObra).toLocaleString("es-CL")}</span>
                  </div>
                  <p className="text-[10px] text-slate-400">{item.detalle}</p>
                </div>
              ))}
            </div>

            {/* Totales */}
            <div className="pt-3 border-t border-white/10 space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between">
                <span>Materiales / Repuestos / Arriendo:</span>
                <span className="font-bold text-white">
                  Bs. {calculo?.subtotalMateriales?.toLocaleString("es-CL")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Mano de Obra & Ensayos:</span>
                <span className="font-bold text-white">
                  Bs. {calculo?.subtotalManoObra?.toLocaleString("es-CL")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Transporte & Logística:</span>
                <span className="font-bold text-white">
                  Bs. {calculo?.montoTransporte?.toLocaleString("es-CL")}
                </span>
              </div>
            </div>

            {/* Total final */}
            <div className="pt-3 border-t border-white/20">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                Total Cotizado Combinado
              </p>
              <h3 className="text-3xl font-black text-white mt-0.5 tracking-tight">
                Bs. {calculo?.totalCotizado?.toLocaleString("es-CL")}
              </h3>

              <div className="mt-3 p-3 rounded-xl bg-white/10 border border-white/10 flex items-center justify-between text-xs">
                <span className="text-slate-300">Anticipo Mínimo (50%):</span>
                <span className="font-black text-[#FF7B42]">
                  Bs. {calculo?.anticipoMinimo?.toLocaleString("es-CL")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

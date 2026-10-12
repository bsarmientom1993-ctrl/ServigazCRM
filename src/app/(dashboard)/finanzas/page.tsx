"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building2,
  Receipt,
  PlusCircle,
  Calendar,
  Layers,
  Wrench,
  Truck,
  Repeat,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Search,
  Lock,
  X,
  ShieldAlert,
} from "lucide-react";

export default function FinanzasPage() {
  const { user } = useAuth();
  const isAdmin = user?.rol === "ADMIN";

  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<any>(null);
  const [egresos, setEgresos] = useState<any[]>([]);
  const [tabActiva, setTabActiva] = useState<"balance" | "gastos" | "costos_trabajos">("balance");

  // Filtros
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [busqueda, setBusqueda] = useState("");

  // Modal Nuevo Gasto
  const [modalGasto, setModalGasto] = useState(false);
  const [savingGasto, setSavingGasto] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [formGasto, setFormGasto] = useState({
    categoria: "SERVICIOS",
    monto: "",
    descripcion: "",
    proveedorInfo: "",
    esRecurrente: false,
    fechaEgreso: new Date().toISOString().slice(0, 10),
  });

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [resBalance, resEgresos] = await Promise.all([
        fetch("/api/finanzas/balance"),
        fetch(`/api/finanzas${filtroCategoria ? `?categoria=${filtroCategoria}` : ""}`),
      ]);

      if (resBalance.ok) {
        const dataB = await resBalance.json();
        setBalance(dataB);
      }

      if (resEgresos.ok) {
        const dataE = await resEgresos.json();
        setEgresos(dataE.egresos || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [filtroCategoria]);

  const handleCrearGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setSavingGasto(true);

    try {
      const res = await fetch("/api/finanzas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formGasto),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Error al registrar el gasto");
        return;
      }

      setSuccessMsg("Gasto operativo registrado exitosamente.");
      setModalGasto(false);
      setFormGasto({
        categoria: "SERVICIOS",
        monto: "",
        descripcion: "",
        proveedorInfo: "",
        esRecurrente: false,
        fechaEgreso: new Date().toISOString().slice(0, 10),
      });
      cargarDatos();
    } catch (err: any) {
      setErrorMsg("Error de conexión: " + err.message);
    } finally {
      setSavingGasto(false);
    }
  };

  const categoriasLabels: Record<string, { label: string; icon: any; color: string }> = {
    ALQUILER: { label: "Alquiler Taller/Tienda", icon: Building2, color: "bg-purple-100 text-purple-800 border-purple-200" },
    SERVICIOS: { label: "Servicios Básicos (Luz/Agua/Net)", icon: Receipt, color: "bg-blue-100 text-blue-800 border-blue-200" },
    NOMINA: { label: "Sueldos & Nómina", icon: DollarSign, color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    INVENTARIO_COMPRAS: { label: "Compras de Inventario", icon: Layers, color: "bg-amber-100 text-amber-800 border-amber-200" },
    TRANSPORTE: { label: "Transporte & Combustible", icon: Truck, color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
    MANTENIMIENTO: { label: "Mantenimiento Local/Herramientas", icon: Wrench, color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
    OTROS: { label: "Otros Gastos", icon: Receipt, color: "bg-slate-100 text-slate-800 border-slate-200" },
  };

  const egresosFiltrados = egresos.filter((eg) => {
    if (!busqueda) return true;
    const term = busqueda.toLowerCase();
    return (
      eg.descripcion?.toLowerCase().includes(term) ||
      eg.proveedorInfo?.toLowerCase().includes(term) ||
      eg.creadoPor?.nombre?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-[#0F2C59] tracking-tight">Finanzas & Estado de Resultados</h1>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Fase 19 (Bolivianos)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Balance consolidado: Ingresos por Servicios vs Costos de Trabajos (#84) vs Gastos Operativos de Oficina.
          </p>
        </div>

        <button
          onClick={() => setModalGasto(true)}
          className="px-4 py-2.5 bg-[#F06529] hover:bg-[#D94E15] text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 cursor-pointer transition-all self-start sm:self-auto"
        >
          <PlusCircle className="h-4 w-4" />
          <span>+ Registrar Gasto Operativo</span>
        </button>
      </div>

      {/* Alertas */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 4 KPIs Clave del Balance Global */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Ingresos Totales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Ingresos por Cobros</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            Bs. {balance?.resumen?.totalIngresos?.toLocaleString("es-CL") || "0"}
          </div>
          <p className="text-[11px] text-emerald-700 font-semibold">Cobros reales en caja y banco</p>
        </div>

        {/* 2. Egresos Trabajos */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Costos de Trabajos (#84)</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Wrench className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            Bs. {balance?.resumen?.totalEgresosFaenas?.toLocaleString("es-CL") || "0"}
          </div>
          <p className="text-[11px] text-slate-500">
            {balance?.desgloseFaenas?.cantidadFaenasCerradas || 0} trabajos cerrados con materiales y mano de obra
          </p>
        </div>

        {/* 3. Gastos Fijos / Operativos */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Gastos de Operación</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            Bs. {balance?.resumen?.totalEgresosOperativos?.toLocaleString("es-CL") || "0"}
          </div>
          <p className="text-[11px] text-slate-500">Alquiler, servicios, combustible y compras</p>
        </div>

        {/* 4. Utilidad Neta Consolidada */}
        <div className={`p-5 rounded-2xl border shadow-xs space-y-2 ${
          (balance?.resumen?.utilidadNetaGlobal || 0) >= 0
            ? "bg-gradient-to-br from-[#0F2C59] to-[#1A3E72] text-white border-[#0F2C59]"
            : "bg-red-900 text-white border-red-800"
        }`}>
          <div className="flex items-center justify-between opacity-80">
            <span className="text-xs font-bold">Ganancia Neta Global</span>
            <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-white/20">
              Margen: {balance?.resumen?.margenNetoPct || 0}%
            </span>
          </div>
          <div className="text-2xl font-black">
            Bs. {balance?.resumen?.utilidadNetaGlobal?.toLocaleString("es-CL") || "0"}
          </div>
          <p className="text-[11px] text-slate-200">Ingresos − (Costos Trabajos + Gastos Oficina)</p>
        </div>
      </div>

      {/* Tabs de Navegación */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setTabActiva("balance")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            tabActiva === "balance"
              ? "bg-[#0F2C59] text-white shadow-xs"
              : "bg-white text-slate-600 border hover:bg-slate-50"
          }`}
        >
          📊 Estado de Resultados & Desglose
        </button>
        <button
          onClick={() => setTabActiva("gastos")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            tabActiva === "gastos"
              ? "bg-[#0F2C59] text-white shadow-xs"
              : "bg-white text-slate-600 border hover:bg-slate-50"
          }`}
        >
          🏢 Gastos Operativos de Oficina ({egresos.length})
        </button>
        <button
          onClick={() => setTabActiva("costos_trabajos")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            tabActiva === "costos_trabajos"
              ? "bg-[#0F2C59] text-white shadow-xs"
              : "bg-white text-slate-600 border hover:bg-slate-50"
          }`}
        >
          🏗️ Costos Directos de Trabajos (#84)
        </button>
      </div>

      {/* TAB 1: ESTADO DE RESULTADOS */}
      {tabActiva === "balance" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
          {/* Gastos por Categoría */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-[#0F2C59] uppercase tracking-wider flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#F06529]" /> Desglose de Gastos Operativos por Rubro
            </h3>

            <div className="space-y-2.5">
              {Object.keys(categoriasLabels).map((catKey) => {
                const monto = balance?.desgloseOperativo?.porCategoria?.[catKey] || 0;
                const totalOp = balance?.resumen?.totalEgresosOperativos || 1;
                const pct = ((monto / totalOp) * 100).toFixed(1);
                const info = categoriasLabels[catKey];
                const Icon = info.icon;

                return (
                  <div key={catKey} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-white shadow-2xs text-[#0F2C59]">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 block">{info.label}</span>
                        <span className="text-[10px] text-slate-400">{pct}% del gasto operativo</span>
                      </div>
                    </div>
                    <span className="font-black text-slate-900 text-sm">
                      Bs. {monto.toLocaleString("es-CL")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Composición de Costos de Trabajos (#84) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-[#0F2C59] uppercase tracking-wider flex items-center gap-2">
              <Wrench className="h-4 w-4 text-[#F06529]" /> Composición de Costos en Trabajos Realizados
            </h3>

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-blue-600" /> Materiales & Cañerías Reales:
                  </span>
                  <strong className="text-slate-900 font-black">
                    Bs. {balance?.desgloseFaenas?.totalMateriales?.toLocaleString("es-CL") || "0"}
                  </strong>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width: `${balance?.resumen?.totalEgresosFaenas ? (balance.desgloseFaenas.totalMateriales / balance.resumen.totalEgresosFaenas) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> Mano de Obra Pagada a Técnicos:
                  </span>
                  <strong className="text-slate-900 font-black">
                    Bs. {balance?.desgloseFaenas?.totalManoObra?.toLocaleString("es-CL") || "0"}
                  </strong>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-emerald-600 h-2 rounded-full"
                    style={{
                      width: `${balance?.resumen?.totalEgresosFaenas ? (balance.desgloseFaenas.totalManoObra / balance.resumen.totalEgresosFaenas) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-[#F06529]" /> Pasajes y Fletes de Transporte:
                  </span>
                  <strong className="text-slate-900 font-black">
                    Bs. {balance?.desgloseFaenas?.totalTransporte?.toLocaleString("es-CL") || "0"}
                  </strong>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-[#F06529] h-2 rounded-full"
                    style={{
                      width: `${balance?.resumen?.totalEgresosFaenas ? (balance.desgloseFaenas.totalTransporte / balance.resumen.totalEgresosFaenas) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Aviso de Privacidad #91 */}
            <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-[11px] text-purple-900 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-purple-600 shrink-0" />
              <span>
                <strong>Regla de Privacidad #91:</strong> Los costos de trabajos son visibles por el Encargado del trabajo y Administrador. Los gastos manuales de oficina son privados por usuario.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LISTADO DE GASTOS OPERATIVOS */}
      {tabActiva === "gastos" && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 animate-fade-in">
          {/* Barra de Filtros */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por descripción, proveedor o usuario..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#F06529]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
              >
                <option value="">Todas las Categorías</option>
                {Object.keys(categoriasLabels).map((cat) => (
                  <option key={cat} value={cat}>
                    {categoriasLabels[cat].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabla de Gastos */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">Descripción & Proveedor</th>
                  <th className="py-3 px-4">Registrado Por</th>
                  <th className="py-3 px-4 text-center">Tipo</th>
                  <th className="py-3 px-4 text-right">Monto (Bs.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {egresosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No hay gastos operativos registrados con este filtro.
                    </td>
                  </tr>
                ) : (
                  egresosFiltrados.map((eg) => {
                    const info = categoriasLabels[eg.categoria] || categoriasLabels.OTROS;
                    return (
                      <tr key={eg.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-600">
                          {new Date(eg.fechaEgreso).toLocaleDateString("es-CL")}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${info.color}`}>
                            {info.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <strong className="text-slate-900 block">{eg.descripcion}</strong>
                          {eg.proveedorInfo && (
                            <span className="text-[11px] text-slate-400">Proveedor: {eg.proveedorInfo}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {eg.creadoPor?.nombre || "Usuario"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {eg.esRecurrente ? (
                            <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold flex items-center gap-1 justify-center border border-purple-200">
                              <Repeat className="h-3 w-3" /> Fijo Mensual
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Gasto Puntual</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                          Bs. {Number(eg.monto).toLocaleString("es-CL")}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: COSTOS REALES DE TRABAJOS (#84) */}
      {tabActiva === "costos_trabajos" && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-[#0F2C59] uppercase tracking-wider flex items-center gap-2">
              <Lock className="h-4 w-4 text-[#F06529]" /> Costos de Trabajos Finalizados (#84)
            </h3>
            <span className="text-xs text-slate-400">Total: {balance?.ultimasFaenasCerradas?.length || 0} trabajos</span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Código / Trabajo</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4 text-right">Materiales</th>
                  <th className="py-3 px-4 text-right">Mano de Obra</th>
                  <th className="py-3 px-4 text-right">Transporte</th>
                  <th className="py-3 px-4 text-right">Costo Total (Bs.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {!balance?.ultimasFaenasCerradas || balance.ultimasFaenasCerradas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No hay trabajos cerrados financieramente todavía.
                    </td>
                  </tr>
                ) : (
                  balance.ultimasFaenasCerradas.map((f: any) => (
                    <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <strong className="text-slate-900 block">{f.trabajo?.codigoCorrelativo}</strong>
                        <span className="text-[10px] text-slate-400">{f.trabajo?.subtipoNombre}</span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700">
                        {f.trabajo?.cliente?.nombreCompleto || "Cliente"}
                      </td>
                      <td className="py-3 px-4 text-right text-blue-700 font-bold">
                        Bs. {Number(f.totalMaterialesReales || Math.max(0, Number(f.totalEgreso || 0) - Number(f.manoObraMonto || 0) - Number(f.transporteMonto || 0))).toLocaleString("es-CL")}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-700 font-bold">
                        Bs. {Number(f.costoManoObraReal || f.manoObraMonto || 0).toLocaleString("es-CL")}
                      </td>
                      <td className="py-3 px-4 text-right text-[#F06529] font-bold">
                        Bs. {Number(f.costoTransporteReal || f.transporteMonto || 0).toLocaleString("es-CL")}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                        Bs. {Number(f.totalEgreso).toLocaleString("es-CL")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR GASTO OPERATIVO */}
      {modalGasto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-[#0F2C59] flex items-center gap-1.5">
                  <PlusCircle className="h-4 w-4 text-[#F06529]" /> Registrar Gasto Operativo
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Gastos de oficina, alquiler, servicios básicos o compras.
                </p>
              </div>
              <button onClick={() => setModalGasto(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCrearGasto} className="space-y-4 text-xs">
              {/* Categoría */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Categoría del Gasto <span className="text-red-500">*</span></label>
                <select
                  required
                  value={formGasto.categoria}
                  onChange={(e) => setFormGasto({ ...formGasto, categoria: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#F06529]"
                >
                  {Object.keys(categoriasLabels).map((cat) => (
                    <option key={cat} value={cat}>
                      {categoriasLabels[cat].label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Monto */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Monto en Bolivianos (Bs.) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={formGasto.monto}
                  onChange={(e) => setFormGasto({ ...formGasto, monto: e.target.value })}
                  placeholder="Ej: 2500"
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-black text-slate-900 text-sm outline-none focus:ring-2 focus:ring-[#F06529]"
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Descripción del Gasto <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formGasto.descripcion}
                  onChange={(e) => setFormGasto({ ...formGasto, descripcion: e.target.value })}
                  placeholder="Ej: Pago alquiler mes de agosto / Factura de luz taller"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-[#F06529]"
                />
              </div>

              {/* Proveedor / Empresa */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Proveedor / Beneficiario (Opcional)</label>
                <input
                  type="text"
                  value={formGasto.proveedorInfo}
                  onChange={(e) => setFormGasto({ ...formGasto, proveedorInfo: e.target.value })}
                  placeholder="Ej: DELAPAZ S.A. / Inmobiliaria Calacoto"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-[#F06529]"
                />
              </div>

              {/* Fecha y Switch Recurrente */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Fecha del Gasto</label>
                  <input
                    type="date"
                    required
                    value={formGasto.fechaEgreso}
                    onChange={(e) => setFormGasto({ ...formGasto, fechaEgreso: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formGasto.esRecurrente}
                      onChange={(e) => setFormGasto({ ...formGasto, esRecurrente: e.target.checked })}
                      className="w-4 h-4 accent-[#F06529] rounded"
                    />
                    <span className="text-[11px] font-bold text-slate-700">Gasto Fijo Mensual</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalGasto(false)}
                  className="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingGasto}
                  className="px-6 py-2.5 bg-[#F06529] hover:bg-[#D94E15] text-white rounded-xl font-black shadow-md cursor-pointer transition-all disabled:opacity-50"
                >
                  {savingGasto ? "Guardando..." : "Guardar Gasto Operativo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

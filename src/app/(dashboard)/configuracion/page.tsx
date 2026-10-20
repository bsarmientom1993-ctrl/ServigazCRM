"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Settings,
  DollarSign,
  Award,
  ShieldCheck,
  PlusCircle,
  Edit2,
  Lock,
  CheckCircle2,
  Sparkles,
  Search,
  Sliders,
  TrendingUp,
  Percent,
  Save,
  X,
  UserPlus,
  Layers,
  Trash2,
  FolderTree,
} from "lucide-react";

export default function ConfiguracionPage() {
  const { user } = useAuth();
  const isAdmin = user?.rol === "ADMIN";

  const [tabActiva, setTabActiva] = useState<"catalogo" | "precios" | "mano_obra" | "dificultad" | "comercial" | "garantias">("catalogo");
  const [dataConfig, setDataConfig] = useState<any>({
    precios: [],
    manoObra: [],
    dificultades: [],
    garantias: [],
    configGeneral: {},
    configDescuento: {},
  });
  const [catalogoServicios, setCatalogoServicios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [errorCatalogo, setErrorCatalogo] = useState("");
  const [msgExito, setMsgExito] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Modales
  const [modalPrecio, setModalPrecio] = useState(false);
  const [precioEditando, setPrecioEditando] = useState<any>({});

  const [modalManoObra, setModalManoObra] = useState(false);
  const [manoObraEditando, setManoObraEditando] = useState<any>({});

  const [modalDificultad, setModalDificultad] = useState(false);
  const [dificultadEditando, setDificultadEditando] = useState<any>({});

  // Modales Catálogo
  const [modalCategoria, setModalCategoria] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState<any>({});

  const [modalSubtipo, setModalSubtipo] = useState(false);
  const [subtipoEditando, setSubtipoEditando] = useState<any>({});

  // Reglas comerciales
  const [reglasComerciales, setReglasComerciales] = useState({
    margenMinimoPct: 25,
    alertaBajoMargenUmbralPct: 20,
    topeMaximoPct: 20,
    pctMaxEncargado: 10,
  });

  const cargarDatos = async () => {
    try {
      const [resConfig, resCat] = await Promise.all([
        fetch("/api/configuracion/precios").then((r) => r.json()),
        fetch("/api/catalogo/servicios").then((r) => r.json()),
      ]);

      setDataConfig(resConfig);
      setCatalogoServicios(Array.isArray(resCat) ? resCat : []);

      if (resConfig.configGeneral) {
        setReglasComerciales({
          margenMinimoPct: Number(resConfig.configGeneral.margenMinimoPct || 25),
          alertaBajoMargenUmbralPct: Number(resConfig.configGeneral.alertaBajoMargenUmbralPct || 20),
          topeMaximoPct: Number(resConfig.configDescuento?.topeMaximoPct || 20),
          pctMaxEncargado: Number(resConfig.configDescuento?.pctMaxEncargado || 10),
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarEjemplos = async () => {
    if (guardando) return;
    setGuardando(true); setErrorCatalogo(""); setMsgExito("");
    try {
      const response = await fetch("/api/catalogo/servicios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "CARGAR_EJEMPLOS" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo completar el catálogo.");
      setMsgExito(result.resumen.categoriasCreadas || result.resumen.serviciosCreados ? "Catálogo completado: " + result.resumen.categoriasCreadas + " categorías y " + result.resumen.serviciosCreados + " servicios añadidos." : "Los ejemplos ya están configurados. Se conservaron tus nombres y los servicios desactivados.");
      await cargarDatos();
    } catch (error: any) { setErrorCatalogo(error.message); } finally { setGuardando(false); }
  };

  // Guardar Edición de Categoría
  const handleGuardarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const res = await fetch("/api/catalogo/servicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "EDITAR_CATEGORIA", data: categoriaEditando }),
      });
      if (res.ok) {
        setMsgExito("✅ Nombre y propiedades del servicio actualizadas en la base de datos.");
        setModalCategoria(false);
        cargarDatos();
      }
    } finally {
      setGuardando(false);
    }
  };

  // Guardar Subtipo (Crear o Editar)
  const handleGuardarSubtipo = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    const accion = subtipoEditando.id ? "EDITAR_SUBTIPO" : "CREAR_SUBTIPO";
    try {
      const res = await fetch("/api/catalogo/servicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion, data: subtipoEditando }),
      });
      if (res.ok) {
        setMsgExito(`✅ Subtipo ${subtipoEditando.id ? "actualizado" : "agregado"} correctamente en PostgreSQL.`);
        setModalSubtipo(false);
        cargarDatos();
      }
    } finally {
      setGuardando(false);
    }
  };

  // Eliminar Subtipo
  const handleEliminarSubtipo = async (id: string, nombre: string) => {
    if (!confirm(`¿Estás seguro de eliminar el subtipo: "${nombre}"?`)) return;
    try {
      const res = await fetch("/api/catalogo/servicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "ELIMINAR_SUBTIPO", data: { id } }),
      });
      if (res.ok) {
        setMsgExito("✅ Subtipo eliminado del catálogo.");
        cargarDatos();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Guardar Precio
  const handleGuardarPrecio = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const res = await fetch("/api/configuracion/precios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "PRECIO", data: precioEditando }),
      });
      if (res.ok) {
        setMsgExito("✅ Tarifa actualizada y guardada en PostgreSQL.");
        setModalPrecio(false);
        cargarDatos();
      }
    } finally {
      setGuardando(false);
    }
  };

  // Guardar Mano de Obra
  const handleGuardarManoObra = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const res = await fetch("/api/configuracion/precios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "MANO_OBRA", data: manoObraEditando }),
      });
      if (res.ok) {
        setMsgExito("✅ Criterio de cálculo de mano de obra actualizado en PostgreSQL.");
        setModalManoObra(false);
        cargarDatos();
      }
    } finally {
      setGuardando(false);
    }
  };

  // Guardar Factores Dificultad
  const handleGuardarDificultad = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const res = await fetch("/api/configuracion/precios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "DIFICULTAD", data: dificultadEditando }),
      });
      if (res.ok) {
        setMsgExito("✅ Factor multiplicador de dificultad actualizado en PostgreSQL.");
        setModalDificultad(false);
        cargarDatos();
      }
    } finally {
      setGuardando(false);
    }
  };

  // Guardar Políticas Comerciales
  const handleGuardarComercial = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const res = await fetch("/api/configuracion/precios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "GENERAL", data: reglasComerciales }),
      });
      if (res.ok) {
        setMsgExito("✅ Políticas de margen y descuentos guardadas en PostgreSQL.");
        cargarDatos();
      }
    } finally {
      setGuardando(false);
    }
  };

  const filteredPrecios = dataConfig.precios?.filter(
    (p: any) =>
      p.concepto.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.subtipoCodigo.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface p-5 rounded-2xl border border-line shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-ink tracking-tight flex items-center gap-2">
            <Settings className="h-5 w-5 text-[#F06529]" />
            Panel de Servicios, Tarifas & Reglas de Negocio
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Administra los nombres de servicios, añade o quita subtipos, y configura fórmulas y precios de cobro.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <span className="text-[11px] font-bold px-3 py-1 bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 rounded-full border border-purple-200 dark:border-purple-900 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Modo Gerente (Control Total)
            </span>
          ) : (
            <span className="text-[11px] font-bold px-3 py-1 bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 rounded-full border border-amber-200 dark:border-amber-900 flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" /> Modo Lectura (Encargado)
            </span>
          )}
        </div>
      </div>

      {msgExito && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{msgExito}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-line pb-2 overflow-x-auto">
        <button
          onClick={() => setTabActiva("catalogo")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            tabActiva === "catalogo"
              ? "bg-[#0F2C59] text-white shadow-sm"
              : "bg-surface text-secondary hover:bg-wash border border-line"
          }`}
        >
          <FolderTree className="h-4 w-4" />
          <span>Catálogo de Servicios & Subtipos</span>
        </button>

        <button
          onClick={() => setTabActiva("precios")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            tabActiva === "precios"
              ? "bg-[#0F2C59] text-white shadow-sm"
              : "bg-surface text-secondary hover:bg-wash border border-line"
          }`}
        >
          Precios por Concepto ({dataConfig.precios?.length || 0})
        </button>

        <button
          onClick={() => setTabActiva("mano_obra")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            tabActiva === "mano_obra"
              ? "bg-[#0F2C59] text-white shadow-sm"
              : "bg-surface text-secondary hover:bg-wash border border-line"
          }`}
        >
          Reglas de Mano de Obra
        </button>

        <button
          onClick={() => setTabActiva("dificultad")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            tabActiva === "dificultad"
              ? "bg-[#0F2C59] text-white shadow-sm"
              : "bg-surface text-secondary hover:bg-wash border border-line"
          }`}
        >
          Factores de Dificultad
        </button>

        <button
          onClick={() => setTabActiva("comercial")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            tabActiva === "comercial"
              ? "bg-[#0F2C59] text-white shadow-sm"
              : "bg-surface text-secondary hover:bg-wash border border-line"
          }`}
        >
          Políticas Comerciales & Márgenes
        </button>

        <button
          onClick={() => setTabActiva("garantias")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            tabActiva === "garantias"
              ? "bg-[#0F2C59] text-white shadow-sm"
              : "bg-surface text-secondary hover:bg-wash border border-line"
          }`}
        >
          Garantías por Defecto
        </button>
      </div>

      {/* ============================================================ */}
      {/* 0. TAB CATÁLOGO DE SERVICIOS Y SUBTIPOS (MODIFICABLE POR GERENTE) */}
      {/* ============================================================ */}
      {tabActiva === "catalogo" && (
        <div className="space-y-4">
          <div className="module-note flex flex-wrap items-center justify-between gap-3"><div><strong>Catálogo inicial con ejemplos</strong><p className="text-xs">Gas, plomería, calefacción y otros servicios. Puedes editar sus nombres y añadir trabajos específicos. Los importes se revisan en cada presupuesto.</p></div>{isAdmin && <button type="button" disabled={guardando} className="theme-toggle" onClick={cargarEjemplos}>{guardando ? "Completando…" : "Añadir ejemplos que falten"}</button>}</div>
          {errorCatalogo && <p role="alert" className="module-error">{errorCatalogo}</p>}
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-300 flex items-center justify-between">
            <div>
              <p className="font-bold">🗂️ Control del Catálogo Oficial de Servicios</p>
              <p className="text-secondary mt-0.5">
                Modifica los nombres de los servicios, añade nuevos subtipos a los menús desplegables o elimina los que no utilices.
              </p>
            </div>
            {isAdmin && (
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-200 text-blue-900 dark:text-blue-300 rounded">
                Edición en Vivo
              </span>
            )}
          </div>

          <div className="space-y-4">
            {catalogoServicios.map((cat) => (
              <div key={cat.id} className="bg-surface rounded-2xl border border-line shadow-xs overflow-hidden">
                {/* Categoría Header */}
                <div className="p-4 bg-canvas border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-ink">{cat.nombre}</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emphasis text-secondary">
                        Código: {cat.codigo}
                      </span>
                      {cat.requiereVisita ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300">
                          Requiere Visita
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                          Sin Visita Previa
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-0.5">{cat.descripcion}</p>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setCategoriaEditando({
                            id: cat.id,
                            nombre: cat.nombre,
                            descripcion: cat.descripcion || "",
                            requiereVisita: cat.requiereVisita,
                          });
                          setModalCategoria(true);
                        }}
                        className="px-3 py-1.5 bg-surface border border-line hover:bg-canvas text-secondary rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-ink" />
                        <span>Editar Nombre Servicio</span>
                      </button>

                      <button
                        onClick={() => {
                          setSubtipoEditando({
                            id: null,
                            categoriaId: cat.id,
                            codigo: `${cat.codigo}_${cat.subtipos?.length + 1}`,
                            nombre: "",
                            descripcion: "",
                          });
                          setModalSubtipo(true);
                        }}
                        className="px-3 py-1.5 bg-[#F06529] hover:bg-[#D94E15] text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span>+ Añadir Subtipo</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Subtipos de la categoría */}
                <div className="p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-faint block mb-2">
                    Subtipos disponibles en el menú desplegable ({cat.subtipos?.length || 0}):
                  </span>

                  {cat.subtipos?.length === 0 ? (
                    <p className="text-xs text-faint italic">No hay subtipos registrados en esta categoría.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {cat.subtipos?.map((sub: any) => (
                        <div
                          key={sub.id}
                          className="p-3 rounded-xl border border-line-soft bg-canvas/50 flex items-center justify-between gap-2 hover:bg-canvas transition-colors"
                        >
                          <div>
                            <span className="text-xs font-bold text-ink block">
                              {sub.nombre}
                            </span>
                            <span className="font-mono text-[10px] text-faint">
                              Código: {sub.codigo}
                            </span>
                          </div>

                          {isAdmin && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  setSubtipoEditando({
                                    id: sub.id,
                                    categoriaId: cat.id,
                                    codigo: sub.codigo,
                                    nombre: sub.nombre,
                                    descripcion: sub.descripcion || "",
                                  });
                                  setModalSubtipo(true);
                                }}
                                className="p-1.5 rounded-lg bg-surface border border-line text-secondary hover:text-[#F06529] cursor-pointer"
                                title="Editar subtipo"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>

                              <button
                                onClick={() => handleEliminarSubtipo(sub.id, sub.nombre)}
                                className="p-1.5 rounded-lg bg-surface border border-line text-red-500 hover:bg-red-50 cursor-pointer"
                                title="Eliminar subtipo"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 1. TAB PRECIOS POR CONCEPTO                                  */}
      {/* ============================================================ */}
      {tabActiva === "precios" && (
        <div className="space-y-4">
          <div className="bg-surface p-4 rounded-2xl border border-line shadow-xs flex items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="h-4 w-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por concepto o material..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-canvas border border-line rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#F06529]"
              />
            </div>

            {isAdmin && (
              <button
                onClick={() => {
                  setPrecioEditando({
                    id: null,
                    subtipoCodigo: "GAS",
                    concepto: "",
                    precioUnitario: 25000,
                    unidad: "metro",
                    diametro: "",
                    material: "",
                  });
                  setModalPrecio(true);
                }}
                className="px-3.5 py-1.5 bg-[#F06529] hover:bg-[#D94E15] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Nueva Tarifa</span>
              </button>
            )}
          </div>

          <div className="bg-surface rounded-2xl border border-line shadow-xs overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-canvas border-b border-line text-faint font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Concepto / Material</th>
                  <th className="py-3 px-4">Criterio Unidad</th>
                  <th className="py-3 px-4 text-right">Precio Unitario (Bs.)</th>
                  {isAdmin && <th className="py-3 px-4 text-center">Editar</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-ink">
                {filteredPrecios?.map((p: any) => (
                  <tr key={p.id} className="hover:bg-canvas/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-ink">{p.concepto}</p>
                      <span className="text-[10px] text-faint">
                        {p.diametro ? `${p.diametro} • ` : ""}{p.material || "Estándar"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-secondary">
                      por {p.unidad}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-ink">
                      Bs. {Number(p.precioUnitario).toLocaleString("es-CL")}
                    </td>
                    {isAdmin && (
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => {
                            setPrecioEditando({
                              id: p.id,
                              subtipoCodigo: p.subtipoCodigo,
                              concepto: p.concepto,
                              precioUnitario: Number(p.precioUnitario),
                              unidad: p.unidad,
                              diametro: p.diametro || "",
                              material: p.material || "",
                            });
                            setModalPrecio(true);
                          }}
                          className="p-1.5 rounded-lg bg-wash hover:bg-[#F06529] text-secondary hover:text-white transition-colors cursor-pointer"
                          title="Editar Precio"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. TAB REGLAS DE MANO DE OBRA                                */}
      {/* ============================================================ */}
      {tabActiva === "mano_obra" && (
        <div className="bg-surface rounded-2xl border border-line shadow-xs overflow-hidden">
          <div className="p-4 border-b border-line-soft flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary">
              Reglas y Fórmulas de Cálculo de Mano de Obra
            </h3>
          </div>

          <table className="w-full text-xs text-left">
            <thead className="bg-canvas border-b border-line text-faint font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Categoría / Servicio</th>
                <th className="py-3 px-4">Fórmula de Cálculo</th>
                <th className="py-3 px-4 text-right">Tarifa Base (Bs.)</th>
                {isAdmin && <th className="py-3 px-4 text-center">Modificar</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-ink">
              {dataConfig.manoObra?.map((mo: any) => (
                <tr key={mo.id} className="hover:bg-canvas/80">
                  <td className="py-3.5 px-4 font-bold text-ink">{mo.subtipoCodigo}</td>
                  <td className="py-3.5 px-4 font-semibold text-secondary">
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                      {mo.tipoCalculo.replace("_", " ").toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-black text-ink">
                    Bs. {Number(mo.tarifaBase).toLocaleString("es-CL")}
                  </td>
                  {isAdmin && (
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => {
                          setManoObraEditando({
                            id: mo.id,
                            subtipoCodigo: mo.subtipoCodigo,
                            tipoCalculo: mo.tipoCalculo,
                            tarifaBase: Number(mo.tarifaBase),
                            factorDificultad: Number(mo.factorDificultad),
                          });
                          setModalManoObra(true);
                        }}
                        className="p-1.5 rounded-lg bg-wash hover:bg-[#F06529] text-secondary hover:text-white transition-colors cursor-pointer"
                        title="Modificar Criterio"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. TAB FACTORES DE DIFICULTAD                                */}
      {/* ============================================================ */}
      {tabActiva === "dificultad" && (
        <div className="bg-surface p-5 rounded-2xl border border-line shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-secondary">
            Factores Multiplicadores de Dificultad (1 al 5)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {dataConfig.dificultades?.map((d: any) => (
              <div
                key={d.nivel}
                className={`p-4 rounded-xl border flex flex-col justify-between ${
                  d.sugerenciaInstaladorExtra ? "border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/40" : "border-line bg-canvas"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-secondary">Nivel {d.nivel}</span>
                    <span className="text-sm font-black text-[#F06529]">{d.factorMultiplicador}x</span>
                  </div>
                  <p className="text-xs text-secondary font-medium">{d.descripcion}</p>
                  {d.sugerenciaInstaladorExtra && (
                    <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 mt-2 flex items-center gap-1">
                      <UserPlus className="h-3.5 w-3.5" /> Sugiere instalador adicional (#95)
                    </p>
                  )}
                </div>

                {isAdmin && (
                  <div className="mt-3 pt-2 border-t border-black/5 flex justify-end">
                    <button
                      onClick={() => {
                        setDificultadEditando({
                          nivel: d.nivel,
                          factorMultiplicador: Number(d.factorMultiplicador),
                          descripcion: d.descripcion,
                          sugerenciaInstaladorExtra: d.sugerenciaInstaladorExtra,
                        });
                        setModalDificultad(true);
                      }}
                      className="text-xs font-bold text-ink hover:text-[#F06529] flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5" /> Modificar Factor
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. TAB POLÍTICAS COMERCIALES                                 */}
      {/* ============================================================ */}
      {tabActiva === "comercial" && (
        <form onSubmit={handleGuardarComercial} className="bg-surface p-6 rounded-2xl border border-line shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-line-soft pb-3">
            <div>
              <h3 className="text-sm font-black text-ink uppercase tracking-wider flex items-center gap-2">
                <Sliders className="h-4 w-4 text-[#F06529]" />
                Políticas de Rentabilidad y Descuentos Comerciales
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Define los márgenes mínimos de ganancia y límites de descuento autorizados.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
            <div className="p-4 rounded-xl bg-canvas border border-line space-y-2">
              <label className="block font-bold text-ink">
                Margen Mínimo de Ganancia Esperado (%)
              </label>
              <input
                type="number"
                disabled={!isAdmin}
                value={reglasComerciales.margenMinimoPct}
                onChange={(e) => setReglasComerciales({ ...reglasComerciales, margenMinimoPct: Number(e.target.value) })}
                className="w-full p-2.5 bg-surface border border-line-strong rounded-xl font-bold text-ink outline-none"
              />
            </div>

            <div className="p-4 rounded-xl bg-canvas border border-line space-y-2">
              <label className="block font-bold text-ink">
                Umbral Alerta Bajo Margen (#94) (%)
              </label>
              <input
                type="number"
                disabled={!isAdmin}
                value={reglasComerciales.alertaBajoMargenUmbralPct}
                onChange={(e) => setReglasComerciales({ ...reglasComerciales, alertaBajoMargenUmbralPct: Number(e.target.value) })}
                className="w-full p-2.5 bg-surface border border-line-strong rounded-xl font-bold text-ink outline-none"
              />
            </div>

            <div className="p-4 rounded-xl bg-canvas border border-line space-y-2">
              <label className="block font-bold text-ink">
                Tope Máximo de Descuento Autorizado por Gerente (%)
              </label>
              <input
                type="number"
                disabled={!isAdmin}
                value={reglasComerciales.topeMaximoPct}
                onChange={(e) => setReglasComerciales({ ...reglasComerciales, topeMaximoPct: Number(e.target.value) })}
                className="w-full p-2.5 bg-surface border border-line-strong rounded-xl font-bold text-ink outline-none"
              />
            </div>

            <div className="p-4 rounded-xl bg-canvas border border-line space-y-2">
              <label className="block font-bold text-ink">
                Límite de Descuento para Encargados (%)
              </label>
              <input
                type="number"
                disabled={!isAdmin}
                value={reglasComerciales.pctMaxEncargado}
                onChange={(e) => setReglasComerciales({ ...reglasComerciales, pctMaxEncargado: Number(e.target.value) })}
                className="w-full p-2.5 bg-surface border border-line-strong rounded-xl font-bold text-ink outline-none"
              />
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={guardando}
                className="px-6 py-2.5 bg-[#F06529] hover:bg-[#D94E15] text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>Guardar Políticas en PostgreSQL</span>
              </button>
            </div>
          )}
        </form>
      )}

      {/* ============================================================ */}
      {/* 5. TAB GARANTÍAS                                             */}
      {/* ============================================================ */}
      {tabActiva === "garantias" && (
        <div className="bg-surface rounded-2xl border border-line shadow-xs overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-canvas border-b border-line text-faint font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Servicio / Categoría</th>
                <th className="py-3 px-4 text-center">Duración Cobertura</th>
                <th className="py-3 px-4">Condiciones por Defecto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-ink">
              {dataConfig.garantias?.map((g: any) => (
                <tr key={g.id} className="hover:bg-canvas/80">
                  <td className="py-3.5 px-4 font-bold text-ink">{g.subtipoCodigo}</td>
                  <td className="py-3.5 px-4 text-center font-black text-[#F06529]">
                    {g.mesesDefecto} Meses
                  </td>
                  <td className="py-3.5 px-4 text-secondary">{g.condiciones || "Garantía estándar Servigaz"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: EDITAR CATEGORÍA DE SERVICIO                          */}
      {/* ============================================================ */}
      {modalCategoria && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-2xl p-6 max-w-md w-full shadow-2xl border border-line-soft space-y-4">
            <div className="flex items-center justify-between border-b border-line-soft pb-3">
              <h3 className="text-sm font-black text-ink flex items-center gap-1.5">
                <Edit2 className="h-4 w-4 text-[#F06529]" />
                Modificar Nombre del Servicio
              </h3>
              <button onClick={() => setModalCategoria(false)} className="text-faint hover:text-secondary cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleGuardarCategoria} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-secondary mb-1">Nombre Visible del Servicio</label>
                <input
                  required
                  value={categoriaEditando.nombre}
                  onChange={(e) => setCategoriaEditando({ ...categoriaEditando, nombre: e.target.value })}
                  className="w-full p-2.5 bg-canvas border border-line rounded-xl font-bold text-ink outline-none focus:ring-2 focus:ring-[#F06529]"
                />
              </div>

              <div>
                <label className="block font-bold text-secondary mb-1">Descripción Breve</label>
                <textarea
                  rows={2}
                  value={categoriaEditando.descripcion}
                  onChange={(e) => setCategoriaEditando({ ...categoriaEditando, descripcion: e.target.value })}
                  className="w-full p-2.5 bg-canvas border border-line rounded-xl font-medium outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-canvas border border-line flex items-center gap-2">
                <input
                  type="checkbox"
                  id="visitaReq"
                  checked={categoriaEditando.requiereVisita}
                  onChange={(e) => setCategoriaEditando({ ...categoriaEditando, requiereVisita: e.target.checked })}
                  className="w-4 h-4 accent-[#F06529] rounded cursor-pointer"
                />
                <label htmlFor="visitaReq" className="text-xs font-bold text-ink cursor-pointer">
                  Requiere Agendar Visita Técnica Previa (Fase 4)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line-soft">
                <button type="button" onClick={() => setModalCategoria(false)} className="px-4 py-2 border rounded-xl font-bold text-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={guardando} className="px-5 py-2 bg-[#F06529] hover:bg-[#D94E15] text-white rounded-xl font-bold">
                  Guardar Nombre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: AÑADIR / EDITAR SUBTIPO                               */}
      {/* ============================================================ */}
      {modalSubtipo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-2xl p-6 max-w-md w-full shadow-2xl border border-line-soft space-y-4">
            <div className="flex items-center justify-between border-b border-line-soft pb-3">
              <h3 className="text-sm font-black text-ink flex items-center gap-1.5">
                <PlusCircle className="h-4 w-4 text-[#F06529]" />
                {subtipoEditando.id ? "Editar Subtipo" : "Añadir Nuevo Subtipo"}
              </h3>
              <button onClick={() => setModalSubtipo(false)} className="text-faint hover:text-secondary cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleGuardarSubtipo} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-secondary mb-1">Nombre / Etiqueta del Subtipo</label>
                <input
                  required
                  value={subtipoEditando.nombre}
                  onChange={(e) => setSubtipoEditando({ ...subtipoEditando, nombre: e.target.value })}
                  placeholder="Ej: Instalación de Termoeléctrico"
                  className="w-full p-2.5 bg-canvas border border-line rounded-xl font-bold text-ink outline-none focus:ring-2 focus:ring-[#F06529]"
                />
              </div>

              <div>
                <label className="block font-bold text-secondary mb-1">Código Identificador</label>
                <input
                  required
                  value={subtipoEditando.codigo}
                  onChange={(e) => setSubtipoEditando({ ...subtipoEditando, codigo: e.target.value })}
                  placeholder="Ej: 1.1.7 o GAS_NUEVO"
                  className="w-full p-2.5 bg-canvas border border-line rounded-xl font-semibold outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line-soft">
                <button type="button" onClick={() => setModalSubtipo(false)} className="px-4 py-2 border rounded-xl font-bold text-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={guardando} className="px-5 py-2 bg-[#F06529] hover:bg-[#D94E15] text-white rounded-xl font-bold">
                  {subtipoEditando.id ? "Guardar Cambios" : "Añadir a Menú Desplegable"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: EDITAR PRECIO                                         */}
      {/* ============================================================ */}
      {modalPrecio && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-2xl p-6 max-w-md w-full shadow-2xl border border-line-soft space-y-4">
            <div className="flex items-center justify-between border-b border-line-soft pb-3">
              <h3 className="text-sm font-black text-ink flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-[#F06529]" />
                {precioEditando.id ? "Editar Precio / Concepto" : "Crear Nueva Tarifa"}
              </h3>
              <button onClick={() => setModalPrecio(false)} className="text-faint hover:text-secondary cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleGuardarPrecio} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-secondary mb-1">Nombre / Concepto</label>
                <input
                  required
                  value={precioEditando.concepto}
                  onChange={(e) => setPrecioEditando({ ...precioEditando, concepto: e.target.value })}
                  className="w-full p-2.5 bg-canvas border border-line rounded-xl font-semibold outline-none focus:ring-2 focus:ring-[#F06529]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-secondary mb-1">Criterio de Cobro</label>
                  <select
                    value={precioEditando.unidad}
                    onChange={(e) => setPrecioEditando({ ...precioEditando, unidad: e.target.value })}
                    className="w-full p-2.5 bg-canvas border border-line rounded-xl font-semibold outline-none"
                  >
                    <option value="metro">Por Metro (m)</option>
                    <option value="unidad">Por Unidad (un)</option>
                    <option value="m2">Por Metro Cuadrado (m²)</option>
                    <option value="proyecto">Por Proyecto / Ensayo</option>
                    <option value="dia">Por Día (Arriendo)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-secondary mb-1">Precio Unitario ($ CLP)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={precioEditando.precioUnitario}
                    onChange={(e) => setPrecioEditando({ ...precioEditando, precioUnitario: e.target.value })}
                    className="w-full p-2.5 bg-canvas border border-line rounded-xl font-bold text-ink outline-none focus:ring-2 focus:ring-[#F06529]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line-soft">
                <button type="button" onClick={() => setModalPrecio(false)} className="px-4 py-2 border rounded-xl font-bold text-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={guardando} className="px-5 py-2 bg-[#F06529] hover:bg-[#D94E15] text-white rounded-xl font-bold">
                  Guardar en BD
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: EDITAR REGLA DE MANO DE OBRA                          */}
      {/* ============================================================ */}
      {modalManoObra && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-2xl p-6 max-w-md w-full shadow-2xl border border-line-soft space-y-4">
            <div className="flex items-center justify-between border-b border-line-soft pb-3">
              <h3 className="text-sm font-black text-ink flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-[#F06529]" />
                Modificar Criterio de Mano de Obra
              </h3>
              <button onClick={() => setModalManoObra(false)} className="text-faint hover:text-secondary cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleGuardarManoObra} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-secondary mb-1">Categoría</label>
                <input
                  disabled
                  value={manoObraEditando.subtipoCodigo}
                  className="w-full p-2.5 bg-wash border border-line rounded-xl font-bold text-secondary cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-bold text-secondary mb-1">Fórmula / Tipo de Cálculo</label>
                <select
                  value={manoObraEditando.tipoCalculo}
                  onChange={(e) => setManoObraEditando({ ...manoObraEditando, tipoCalculo: e.target.value })}
                  className="w-full p-2.5 bg-canvas border border-line rounded-xl font-semibold outline-none focus:ring-2 focus:ring-[#F06529]"
                >
                  <option value="por_metro">Por Metro Lineal Instalado</option>
                  <option value="por_trabajo">Tarifa Fija por Trabajo / Servicio</option>
                  <option value="por_hora">Por Hora Hombre</option>
                  <option value="por_dia">Por Jornada / Día</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-secondary mb-1">Tarifa Base ($ CLP)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={manoObraEditando.tarifaBase}
                  onChange={(e) => setManoObraEditando({ ...manoObraEditando, tarifaBase: e.target.value })}
                  className="w-full p-2.5 bg-canvas border border-line rounded-xl font-bold text-ink outline-none focus:ring-2 focus:ring-[#F06529]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line-soft">
                <button type="button" onClick={() => setModalManoObra(false)} className="px-4 py-2 border rounded-xl font-bold text-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={guardando} className="px-5 py-2 bg-[#F06529] hover:bg-[#D94E15] text-white rounded-xl font-bold">
                  Guardar en BD
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: EDITAR FACTOR DE DIFICULTAD                           */}
      {/* ============================================================ */}
      {modalDificultad && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-2xl p-6 max-w-md w-full shadow-2xl border border-line-soft space-y-4">
            <div className="flex items-center justify-between border-b border-line-soft pb-3">
              <h3 className="text-sm font-black text-ink flex items-center gap-1.5">
                <UserPlus className="h-4 w-4 text-[#F06529]" />
                Modificar Factor Dificultad Nivel {dificultadEditando.nivel}
              </h3>
              <button onClick={() => setModalDificultad(false)} className="text-faint hover:text-secondary cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleGuardarDificultad} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-secondary mb-1">Factor Multiplicador</label>
                <input
                  type="number"
                  step="0.05"
                  min="1.0"
                  max="3.0"
                  required
                  value={dificultadEditando.factorMultiplicador}
                  onChange={(e) => setDificultadEditando({ ...dificultadEditando, factorMultiplicador: Number(e.target.value) })}
                  className="w-full p-2.5 bg-canvas border border-line rounded-xl font-bold text-ink outline-none focus:ring-2 focus:ring-[#F06529]"
                />
              </div>

              <div>
                <label className="block font-bold text-secondary mb-1">Descripción</label>
                <textarea
                  rows={2}
                  required
                  value={dificultadEditando.descripcion}
                  onChange={(e) => setDificultadEditando({ ...dificultadEditando, descripcion: e.target.value })}
                  className="w-full p-2.5 bg-canvas border border-line rounded-xl font-semibold outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="extraInst"
                  checked={dificultadEditando.sugerenciaInstaladorExtra}
                  onChange={(e) => setDificultadEditando({ ...dificultadEditando, sugerenciaInstaladorExtra: e.target.checked })}
                  className="w-4 h-4 accent-[#F06529] rounded cursor-pointer"
                />
                <label htmlFor="extraInst" className="text-xs font-bold text-amber-900 dark:text-amber-300 cursor-pointer">
                  Activar sugerencia de instalador adicional en cotizador (#95)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line-soft">
                <button type="button" onClick={() => setModalDificultad(false)} className="px-4 py-2 border rounded-xl font-bold text-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={guardando} className="px-5 py-2 bg-[#F06529] hover:bg-[#D94E15] text-white rounded-xl font-bold">
                  Guardar en BD
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

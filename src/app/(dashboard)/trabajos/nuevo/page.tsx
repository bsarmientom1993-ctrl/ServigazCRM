"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Flame,
  Thermometer,
  Wrench,
  Droplets,
  ShoppingBag,
  ClipboardCheck,
  UserPlus,
  UserCheck,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  User,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Check,
  ShieldCheck,
  Search,
  Zap,
  X,
  Star,
  Layers,
  Ruler,
} from "lucide-react";

const ICON_MAP: any = {
  Flame,
  Thermometer,
  Wrench,
  Droplets,
  ClipboardCheck,
  ShoppingBag,
};

// Subtipos que NO requieren levantamiento de metros (Servicios Directos / Tarifa Fija / Venta Tienda / Equipos / Otros)
const SERVICIOS_DIRECTOS_CODIGOS = [
  "3.", "3.1", "3.2", "3.3", "3.4", "3.5", "3.6",
  "OTR", "OTR.1", "OTR.2", "OTR.3", "OTR.4", "OTR.5",
  "2.1", "2.1.1", "2.1.2", "2.1.3", "TIENDA"
];

export default function NuevoTrabajoWizardPage() {
  const router = useRouter();

  // Paso actual del Wizard (1, 2, 3)
  const [pasoActual, setPasoActual] = useState<1 | 2 | 3>(1);

  // Estados de datos maestros
  const [clientes, setClientes] = useState<any[]>([]);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // PASO 1: Datos del Cliente
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [clienteSeleccionadoObj, setClienteSeleccionadoObj] = useState<any>(null);
  const [formDataCliente, setFormDataCliente] = useState({
    nombreCompleto: "",
    telefono: "",
    direccion: "",
    email: "",
  });

  // Sugerencias en tiempo real
  const [sugerenciasClientes, setSugerenciasClientes] = useState<any[]>([]);
  const [mostrarDropdownSugerencias, setMostrarDropdownSugerencias] = useState(false);
  const sugerenciasRef = useRef<HTMLDivElement>(null);

  // PASO 2: Requerimiento & Servicios
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<string[]>(["GAS"]);
  const [subtiposElegidos, setSubtiposElegidos] = useState<Record<string, string>>({});
  const [observacionesRequerimiento, setObservacionesRequerimiento] = useState("");

  // PASO 3: Asignación y Horario
  const [tecnicoId, setTecnicoId] = useState("");
  const [fechaVisita, setFechaVisita] = useState("");

  useEffect(() => {
    // Horario sugerido por defecto: Mañana 10:00 AM
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    manana.setHours(10, 0, 0, 0);
    const tzOffset = manana.getTimezoneOffset() * 60000;
    const localISOTime = new Date(manana.getTime() - tzOffset).toISOString().slice(0, 16);
    setFechaVisita(localISOTime);

    Promise.all([
      fetch("/api/clientes").then((r) => r.json()),
      fetch("/api/tecnicos").then((r) => r.json()),
      fetch("/api/catalogo/servicios").then((r) => r.json()),
    ])
      .then(([dataClientes, dataTecnicos, dataCatalogo]) => {
        setClientes(Array.isArray(dataClientes) ? dataClientes : []);
        setTecnicos(Array.isArray(dataTecnicos) ? dataTecnicos : []);
        if (dataTecnicos?.length > 0) setTecnicoId(dataTecnicos[0].id);

        if (Array.isArray(dataCatalogo) && dataCatalogo.length > 0) {
          setCatalogo(dataCatalogo);
          const gasCat = dataCatalogo.find((c) => c.codigo === "GAS") || dataCatalogo[0];
          setCategoriasSeleccionadas([gasCat.codigo]);
          if (gasCat.subtipos?.length > 0) {
            setSubtiposElegidos({ [gasCat.codigo]: gasCat.subtipos[0].codigo });
          }
        }

        // Restaurar borrador previo si existe
        try {
          const saved = localStorage.getItem("servigaz_wizard_draft");
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.formDataCliente) setFormDataCliente(parsed.formDataCliente);
            if (parsed.clienteId) setClienteId(parsed.clienteId);
            if (parsed.clienteSeleccionadoObj) setClienteSeleccionadoObj(parsed.clienteSeleccionadoObj);
            if (parsed.categoriasSeleccionadas?.length) setCategoriasSeleccionadas(parsed.categoriasSeleccionadas);
            if (parsed.subtiposElegidos) setSubtiposElegidos(parsed.subtiposElegidos);
            if (parsed.observacionesRequerimiento) setObservacionesRequerimiento(parsed.observacionesRequerimiento);
            if (parsed.tecnicoId) setTecnicoId(parsed.tecnicoId);
            if (parsed.fechaVisita) setFechaVisita(parsed.fechaVisita);
            if (parsed.pasoActual) setPasoActual(parsed.pasoActual);
          }
        } catch (err) {}
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  // Guardar en borrador automáticamente cada cambio
  useEffect(() => {
    if (!loading) {
      try {
        const draft = {
          formDataCliente,
          clienteId,
          clienteSeleccionadoObj,
          categoriasSeleccionadas,
          subtiposElegidos,
          observacionesRequerimiento,
          tecnicoId,
          fechaVisita,
          pasoActual,
        };
        localStorage.setItem("servigaz_wizard_draft", JSON.stringify(draft));
      } catch (err) {}
    }
  }, [formDataCliente, clienteId, clienteSeleccionadoObj, categoriasSeleccionadas, subtiposElegidos, observacionesRequerimiento, tecnicoId, fechaVisita, pasoActual, loading]);

  // Confirmación al intentar salir o refrescar con datos no guardados
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (formDataCliente.telefono || formDataCliente.nombreCompleto) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [formDataCliente]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sugerenciasRef.current && !sugerenciasRef.current.contains(e.target as Node)) {
        setMostrarDropdownSugerencias(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Lógica de Búsqueda y Sugerencias Inteligentes en Tiempo Real
  const buscarSugerencias = (texto: string) => {
    if (!texto || texto.trim().length < 2) {
      setSugerenciasClientes([]);
      setMostrarDropdownSugerencias(false);
      return;
    }

    const query = texto.toLowerCase().replace(/[\s\+\-\(\)]/g, "");
    const matches = clientes.filter((c) => {
      const nomMatch = c.nombreCompleto?.toLowerCase().includes(texto.toLowerCase());
      const dirMatch = c.direccion?.toLowerCase().includes(texto.toLowerCase());
      const tels = Array.isArray(c.telefonos) ? c.telefonos.join(" ") : String(c.telefonos || "");
      const telClean = tels.replace(/[\s\+\-\(\)]/g, "");
      const telMatch = telClean.includes(query);
      return nomMatch || dirMatch || telMatch;
    });

    setSugerenciasClientes(matches.slice(0, 4));
    setMostrarDropdownSugerencias(matches.length > 0);
  };

  const handleTelefonoChange = (val: string) => {
    setFormDataCliente((prev) => ({ ...prev, telefono: val }));
    setClienteId(null);
    setClienteSeleccionadoObj(null);
    buscarSugerencias(val);
  };

  const handleNombreChange = (val: string) => {
    setFormDataCliente((prev) => ({ ...prev, nombreCompleto: val }));
    setClienteId(null);
    setClienteSeleccionadoObj(null);
    buscarSugerencias(val);
  };

  const seleccionarSugerencia = (cliente: any) => {
    const primerTel = Array.isArray(cliente.telefonos) ? cliente.telefonos[0] : cliente.telefonos || "";
    setFormDataCliente({
      nombreCompleto: cliente.nombreCompleto,
      telefono: primerTel,
      direccion: cliente.direccion || "",
      email: cliente.email || "",
    });
    setClienteId(cliente.id);
    setClienteSeleccionadoObj(cliente);
    setMostrarDropdownSugerencias(false);
    setErrorMsg("");
  };

  const limpiarAutocompletado = () => {
    setClienteId(null);
    setClienteSeleccionadoObj(null);
    setFormDataCliente({
      nombreCompleto: "",
      telefono: "",
      direccion: "",
      email: "",
    });
  };

  const toggleCategoria = (codigoCat: string) => {
    setCategoriasSeleccionadas((prev) => {
      if (prev.includes(codigoCat)) {
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== codigoCat);
      } else {
        const cat = catalogo.find((c) => c.codigo === codigoCat);
        if (cat && cat.subtipos?.length > 0 && !subtiposElegidos[codigoCat]) {
          setSubtiposElegidos((sub) => ({ ...sub, [codigoCat]: cat.subtipos[0].codigo }));
        }
        return [...prev, codigoCat];
      }
    });
  };

  const handleSubtipoChange = (catCodigo: string, subCodigo: string) => {
    setSubtiposElegidos((prev) => ({ ...prev, [catCodigo]: subCodigo }));
  };

  // Determinar si los servicios elegidos requieren visita técnica de levantamiento de metros
  const codigosSubtiposSeleccionados = categoriasSeleccionadas.map((c) => subtiposElegidos[c]).filter(Boolean);
  const esServicioDirecto = categoriasSeleccionadas.length > 0 &&
    categoriasSeleccionadas.every(codigo => catalogo.find(c => c.codigo === codigo)?.requiereVisita === false);

  // Validaciones antes de avanzar paso
  const avanzarAlPaso2 = () => {
    setErrorMsg("");
    if (!formDataCliente.telefono.trim()) {
      setErrorMsg("Por favor, ingresa el número de teléfono o WhatsApp del cliente.");
      return;
    }
    if (!formDataCliente.nombreCompleto.trim()) {
      setErrorMsg("Por favor, ingresa el nombre completo del cliente.");
      return;
    }
    if (!formDataCliente.direccion.trim()) {
      setErrorMsg("Por favor, ingresa la dirección de la instalación.");
      return;
    }
    setPasoActual(2);
  };

  const avanzarAlPaso3 = () => {
    setErrorMsg("");
    if (categoriasSeleccionadas.length === 0) {
      setErrorMsg("Debes seleccionar al menos un tipo de servicio.");
      return;
    }
    setPasoActual(3);
  };

  const atajoFecha = (tipo: "hoy_tarde" | "manana_10" | "manana_15") => {
    const d = new Date();
    if (tipo === "hoy_tarde") {
      d.setHours(15, 30, 0, 0);
    } else if (tipo === "manana_10") {
      d.setDate(d.getDate() + 1);
      d.setHours(10, 0, 0, 0);
    } else if (tipo === "manana_15") {
      d.setDate(d.getDate() + 1);
      d.setHours(15, 0, 0, 0);
    }
    const tzOffset = d.getTimezoneOffset() * 60000;
    setFechaVisita(new Date(d.getTime() - tzOffset).toISOString().slice(0, 16));
  };

  // Envío final
  const handleSubmitFinal = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!esServicioDirecto && !tecnicoId) {
      setErrorMsg("Debes asignar un técnico instalador para la visita de medición.");
      return;
    }
    if (!esServicioDirecto && !fechaVisita) {
      setErrorMsg("Debes definir la fecha y hora de la visita de medición.");
      return;
    }

    setSaving(true);

    try {
      const subtiposNombres = categoriasSeleccionadas.map((catCodigo) => {
        const cat = catalogo.find((c) => c.codigo === catCodigo);
        const subCod = subtiposElegidos[catCodigo] || cat?.subtipos?.[0]?.codigo;
        const subObj = cat?.subtipos?.find((s: any) => s.codigo === subCod);
        return subObj?.nombre || cat?.nombre;
      });

      const payload = {
        clienteId: clienteId || null,
        nuevoCliente: clienteId
          ? null
          : {
              nombreCompleto: formDataCliente.nombreCompleto,
              telefono: formDataCliente.telefono,
              direccion: formDataCliente.direccion,
              email: formDataCliente.email || null,
            },
        tipoFlujo: esServicioDirecto ? "SIMPLIFICADO" : "COMPLETO",
        requiereVisitaLevantamiento: !esServicioDirecto,
        subtipoCodigo: categoriasSeleccionadas.map(c => subtiposElegidos[c]).filter(Boolean).join("_"),
        subtipoNombre: subtiposNombres.join(" + "),
        observaciones: observacionesRequerimiento,
        dificultadNivel: 1,
        tecnicoId: tecnicoId || null,
        fechaProgramada: fechaVisita || null,
      };

      const res = await fetch("/api/trabajos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setErrorMsg(data.error || "Error al procesar la solicitud");
        setSaving(false);
        return;
      }

      // Limpiar borrador local al guardar con éxito
      try {
        localStorage.removeItem("servigaz_wizard_draft");
      } catch (err) {}

      // Redirigir a la ficha del trabajo creado
      router.push(`/trabajos/${data.id}`);
    } catch (e: any) {
      setErrorMsg(e.message || "Error al conectar con el servidor");
      setSaving(false);
    }
  };

  const tecnicoSeleccionadoObj = tecnicos.find((t) => t.id === tecnicoId);

  const serviciosNombresResumen = categoriasSeleccionadas
    .map((catCodigo) => {
      const cat = catalogo.find((c) => c.codigo === catCodigo);
      const subCod = subtiposElegidos[catCodigo] || cat?.subtipos?.[0]?.codigo;
      const subObj = cat?.subtipos?.find((s: any) => s.codigo === subCod);
      return subObj?.nombre || cat?.nombre;
    })
    .join(" + ");

  if (loading) {
    return (
      <div className="p-12 text-center text-muted font-bold text-xs">
        Cargando asistente con flujos dinámicos...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-surface p-5 rounded-2xl border border-line shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
              Wizard Inteligente con Flujo Dinámico
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-300 font-bold flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" /> Autocompletado Activo
            </span>
          </div>
          <h2 className="text-xl font-black text-ink tracking-tight mt-1 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#F06529]" />
            Nueva Solicitud de Trabajo & Cotización
          </h2>
          <p className="text-xs text-muted mt-0.5">
            El sistema adapta el flujo automáticamente: instalaciones requieren levantamiento en terreno; revisiones y mantenimientos se cotizan y ejecutan directamente.
          </p>
        </div>
      </div>

      {/* STEPPER / BARRA DE PROGRESO */}
      <div className="bg-surface p-4 rounded-2xl border border-line shadow-xs">
        <div className={`grid gap-2 ${esServicioDirecto ? "grid-cols-2" : "grid-cols-3"}`}>
          {/* Paso 1 */}
          <button
            type="button"
            onClick={() => setPasoActual(1)}
            className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
              pasoActual === 1
                ? "border-[#0F2C59] bg-[#0F2C59] text-white shadow-xs"
                : pasoActual > 1
                ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300"
                : "border-line bg-canvas text-faint"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                pasoActual === 1
                  ? "bg-[#F06529] text-white"
                  : pasoActual > 1
                  ? "bg-emerald-600 text-white"
                  : "bg-emphasis text-secondary"
              }`}
            >
              {pasoActual > 1 ? <Check className="h-4 w-4" /> : "1"}
            </div>
            <div className="hidden sm:block">
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">Paso 1</span>
              <span className="text-xs font-black">Cliente & Sugerencias</span>
            </div>
          </button>

          {/* Paso 2 */}
          <button
            type="button"
            onClick={() => {
              if (pasoActual === 1) avanzarAlPaso2();
              else setPasoActual(2);
            }}
            className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
              pasoActual === 2
                ? "border-[#0F2C59] bg-[#0F2C59] text-white shadow-xs"
                : pasoActual > 2
                ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300"
                : "border-line bg-canvas text-faint"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                pasoActual === 2
                  ? "bg-[#F06529] text-white"
                  : pasoActual > 2
                  ? "bg-emerald-600 text-white"
                  : "bg-emphasis text-secondary"
              }`}
            >
              {pasoActual > 2 ? <Check className="h-4 w-4" /> : "2"}
            </div>
            <div className="hidden sm:block">
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">Paso 2</span>
              <span className="text-xs font-black">
                {esServicioDirecto ? "Servicio & Confirmación" : "Tipo de Servicio"}
              </span>
            </div>
          </button>

          {/* Paso 3 (Solo visible cuando requiere levantamiento en terreno) */}
          {!esServicioDirecto && (
            <button
              type="button"
              onClick={() => {
                if (pasoActual === 1) avanzarAlPaso2();
                else if (pasoActual === 2) avanzarAlPaso3();
              }}
              className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                pasoActual === 3
                  ? "border-[#0F2C59] bg-[#0F2C59] text-white shadow-xs"
                  : "border-line bg-canvas text-faint"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                  pasoActual === 3 ? "bg-[#F06529] text-white" : "bg-emphasis text-secondary"
                }`}
              >
                3
              </div>
              <div className="hidden sm:block">
                <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">Paso 3</span>
                <span className="text-xs font-black">Medición en Terreno</span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Alerta de Error */}
      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-2 animate-fade-in">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ================================================================ */}
      {/* PASO 1: CLIENTE CON SUGERENCIAS EN VIVO                          */}
      {/* ================================================================ */}
      {pasoActual === 1 && (
        <div className="bg-surface p-6 rounded-2xl border border-line shadow-xs space-y-5 animate-fade-in relative" ref={sugerenciasRef}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line-soft pb-3">
            <div>
              <h3 className="text-sm font-black text-ink uppercase tracking-wider flex items-center gap-2">
                <User className="h-4 w-4 text-[#F06529]" />
                Paso 1: Identificación del Cliente
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Ingresa el teléfono o nombre. Si ya existe en la base de datos, aparecerá abajo para autocompletar.
              </p>
            </div>

            {clienteSeleccionadoObj && (
              <span className="text-xs font-bold px-3 py-1 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-full flex items-center gap-1.5 self-start sm:self-auto">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                Cliente {clienteSeleccionadoObj.nivelFidelizacion} Vinculado
              </span>
            )}
          </div>

          {/* Banner de Cliente Encontrado */}
          {clienteSeleccionadoObj && (
            <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-600 text-white">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-emerald-950 dark:text-emerald-300">
                    {clienteSeleccionadoObj.nombreCompleto}
                  </p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Fidelización: <strong>{clienteSeleccionadoObj.nivelFidelizacion}</strong> • {clienteSeleccionadoObj.direccion}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={limpiarAutocompletado}
                className="px-2.5 py-1 bg-surface border border-emerald-300 dark:border-emerald-900 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <X className="h-3 w-3" />
                <span>Modificar</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* 1. Teléfono / WhatsApp */}
            <div className="relative">
              <label className="block font-bold text-secondary mb-1">
                Teléfono Celular / WhatsApp <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="h-4 w-4 text-[#F06529] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={formDataCliente.telefono}
                  onChange={(e) => handleTelefonoChange(e.target.value)}
                  onFocus={() => {
                    if (formDataCliente.telefono.length >= 2) buscarSugerencias(formDataCliente.telefono);
                  }}
                  placeholder="Ej: 71523411"
                  className="w-full pl-9 pr-3 py-2.5 bg-canvas border border-line rounded-xl font-bold text-ink outline-none focus:ring-2 focus:ring-[#F06529]"
                />
              </div>
              <span className="text-[10px] text-faint mt-0.5 block">
                Escribe números para ver coincidencias de clientes
              </span>
            </div>

            {/* 2. Nombre Completo */}
            <div className="relative">
              <label className="block font-bold text-secondary mb-1">
                Nombre Completo del Cliente / Razón Social <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="h-4 w-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={formDataCliente.nombreCompleto}
                  onChange={(e) => handleNombreChange(e.target.value)}
                  onFocus={() => {
                    if (formDataCliente.nombreCompleto.length >= 2) buscarSugerencias(formDataCliente.nombreCompleto);
                  }}
                  placeholder="Ej: Carlos Mendoza o Condominio Las Palmas"
                  className="w-full pl-9 pr-3 py-2.5 bg-canvas border border-line rounded-xl font-semibold text-ink outline-none focus:ring-2 focus:ring-[#F06529]"
                />
              </div>
              <span className="text-[10px] text-faint mt-0.5 block">
                Nombre particular o de empresa
              </span>
            </div>

            {/* POPUP FLOTANTE DE SUGERENCIAS */}
            {mostrarDropdownSugerencias && sugerenciasClientes.length > 0 && (
              <div className="sm:col-span-2 p-3 bg-gradient-to-br from-slate-900 to-[#0F2C59] text-white rounded-2xl shadow-xl border border-slate-700 space-y-2 animate-fade-in z-20">
                <div className="flex items-center justify-between text-[11px] text-[#FF7B42] font-bold px-1">
                  <span className="flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-amber-400" />
                    Clientes encontrados en la Base de Datos (Haz clic para autocompletar):
                  </span>
                  <button
                    type="button"
                    onClick={() => setMostrarDropdownSugerencias(false)}
                    className="text-faint hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sugerenciasClientes.map((sug) => (
                    <div
                      key={sug.id}
                      onClick={() => seleccionarSugerencia(sug)}
                      className="p-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-all cursor-pointer flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-xs group-hover:text-[#FF7B42]">
                            {sug.nombreCompleto}
                          </span>
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300">
                            {sug.nivelFidelizacion}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1 flex items-center gap-1">
                          <Phone className="h-3 w-3 text-emerald-400 shrink-0" />
                          {Array.isArray(sug.telefonos) ? sug.telefonos.join(", ") : sug.telefonos}
                        </p>
                        <p className="text-[10px] text-faint truncate mt-0.5">
                          {sug.direccion}
                        </p>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-400 mt-2 block group-hover:underline">
                        ⚡ Cargar datos de {sug.nombreCompleto.split(" ")[0]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Dirección */}
            <div className="sm:col-span-2">
              <label className="block font-bold text-secondary mb-1">
                Dirección Domiciliaria / Ubicación de la Instalación <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="h-4 w-4 text-[#F06529] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={formDataCliente.direccion}
                  onChange={(e) => setFormDataCliente({ ...formDataCliente, direccion: e.target.value })}
                  placeholder="Ej: Av. Ballivián #450, Calacoto, La Paz"
                  className="w-full pl-9 pr-3 py-2.5 bg-canvas border border-line rounded-xl font-semibold text-ink outline-none focus:ring-2 focus:ring-[#F06529]"
                />
              </div>
            </div>

            {/* 4. Correo Electrónico */}
            <div className="sm:col-span-2">
              <label className="block font-bold text-secondary mb-1">Correo Electrónico (Opcional)</label>
              <div className="relative">
                <Mail className="h-4 w-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={formDataCliente.email}
                  onChange={(e) => setFormDataCliente({ ...formDataCliente, email: e.target.value })}
                  placeholder="cliente@ejemplo.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-canvas border border-line rounded-xl font-semibold text-ink outline-none focus:ring-2 focus:ring-[#F06529]"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-line-soft">
            <button
              type="button"
              onClick={avanzarAlPaso2}
              className="px-6 py-3 bg-[#0F2C59] hover:bg-[#1A3E72] text-white rounded-xl font-black text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all"
            >
              <span>Continuar al Paso 2: Tipo de Servicio</span>
              <ArrowRight className="h-4 w-4 text-[#F06529]" />
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* PASO 2: SERVICIO & DETECCIÓN DINÁMICA DE FLUJO                   */}
      {/* ================================================================ */}
      {pasoActual === 2 && (
        <div className="bg-surface p-6 rounded-2xl border border-line shadow-xs space-y-5 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line-soft pb-3">
            <div>
              <h3 className="text-sm font-black text-ink uppercase tracking-wider flex items-center gap-2">
                <Wrench className="h-4 w-4 text-[#F06529]" />
                Paso 2: ¿Qué tipo de instalación o servicio requiere?
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Selecciona la categoría. El sistema identificará si es una instalación grande o un servicio directo.
              </p>
            </div>
          </div>

          {/* Banner de Flujo Dinámico Inteligente */}
          {esServicioDirecto ? (
            <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 flex items-center gap-3 text-xs text-purple-900 dark:text-purple-300">
              <div className="p-2 rounded-lg bg-purple-600 text-white shrink-0">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <p className="font-black text-purple-950 dark:text-purple-300">
                  ⚡ Servicio Directo (Tarifa Fija) — No Requiere Levantamiento de Metros
                </p>
                <p className="text-[11px] text-purple-700 dark:text-purple-300 mt-0.5">
                  Para revisión de calefón, mantenimiento o calibración, la orden se cotiza con tarifa estándar (Bs. 180 - 260) y se agenda directamente para la atención técnica.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-center gap-3 text-xs text-blue-900 dark:text-blue-300">
              <div className="p-2 rounded-lg bg-[#0F2C59] text-white shrink-0">
                <Ruler className="h-4 w-4" />
              </div>
              <div>
                <p className="font-black text-ink">
                  📐 Obra / Instalación — Requiere Visita Técnica de Medición
                </p>
                <p className="text-[11px] text-secondary mt-0.5">
                  El técnico acudirá al terreno a medir metros lineales de cañería (visto/empotrado) y evaluar dificultad antes de emitir el presupuesto final.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {catalogo.map((cat) => {
              const Icon = ICON_MAP[cat.icono] || Wrench;
              const isSelected = categoriasSeleccionadas.includes(cat.codigo);
              const subActivo = subtiposElegidos[cat.codigo] || cat.subtipos?.[0]?.codigo;

              return (
                <div
                  key={cat.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                    isSelected
                      ? "border-[#F06529] bg-[#F06529]/5 ring-2 ring-[#F06529]"
                      : "border-line bg-canvas/60 hover:border-line-strong opacity-85"
                  }`}
                >
                  <div>
                    <div
                      onClick={() => toggleCategoria(cat.codigo)}
                      className="flex items-center justify-between cursor-pointer mb-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-surface shadow-xs text-ink">
                          <Icon className="h-4 w-4" />
                        </div>
                        <h4 className="text-xs font-black text-ink">{cat.nombre}</h4>
                      </div>

                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 accent-[#F06529] rounded cursor-pointer"
                      />
                    </div>

                    <p className="text-[11px] text-secondary mb-3">{cat.descripcion}</p>
                  </div>

                  {/* Menú Desplegable de Subtipos */}
                  <div className="pt-2 border-t border-black/10">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-1">
                      Subtipo Específico:
                    </label>
                    <select
                      disabled={!isSelected}
                      value={subActivo}
                      onChange={(e) => handleSubtipoChange(cat.codigo, e.target.value)}
                      className={`w-full p-2.5 bg-surface border rounded-xl text-xs font-bold transition-all outline-none ${
                        isSelected
                          ? "border-line-strong text-ink focus:ring-2 focus:ring-[#F06529]"
                          : "border-line text-faint bg-wash cursor-not-allowed"
                      }`}
                    >
                      {cat.subtipos?.map((sub: any) => (
                        <option key={sub.id} value={sub.codigo}>
                          {sub.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Banner Dinámico si es Servicio Directo */}
          {esServicioDirecto ? (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2.5 shadow-2xs">
              <Zap className="h-5 w-5 text-[#F06529] shrink-0 mt-0.5" />
              <div>
                <strong className="font-black text-amber-950 dark:text-amber-300 block text-xs">
                  ⚡ Servicio Directo (Sin Visita de Medición)
                </strong>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                  Este servicio (Equipos, Calefones, Otros trámites o Tienda) cuenta con tarifa establecida y no necesita medición de metros en terreno. Se emitirá el presupuesto directamente.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2.5">
              <Ruler className="h-4 w-4 text-blue-600 dark:text-blue-300 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-800 dark:text-blue-300">
                <strong>Instalación de Red / Obra:</strong> Requiere visita previa de un técnico para medir metros lineales y evaluar el trazado.
              </p>
            </div>
          )}

          <div className="text-xs pt-2">
            <label className="block font-bold text-secondary mb-1">
              Observaciones / Lo que pide el cliente (Opcional):
            </label>
            <textarea
              rows={2}
              value={observacionesRequerimiento}
              onChange={(e) => setObservacionesRequerimiento(e.target.value)}
              placeholder="Ej: Calefón no enciende la chispa / Fuga menor en válvula de paso..."
              className="w-full p-3 bg-canvas border border-line rounded-xl font-medium outline-none focus:ring-2 focus:ring-[#F06529]"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-line-soft">
            <button
              type="button"
              onClick={() => setPasoActual(1)}
              className="px-5 py-2.5 border border-line hover:bg-canvas text-secondary rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Volver a Cliente</span>
            </button>

            {esServicioDirecto ? (
              <button
                type="button"
                disabled={saving}
                onClick={handleSubmitFinal}
                className="px-7 py-3 bg-[#F06529] hover:bg-[#D94E15] text-white rounded-xl font-black text-xs shadow-lg flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {saving ? (
                  <span>Creando orden...</span>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>⚡ Crear Orden y Emitir Presupuesto Directo</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={avanzarAlPaso3}
                className="px-6 py-3 bg-[#0F2C59] hover:bg-[#1A3E72] text-white rounded-xl font-black text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all"
              >
                <span>Continuar: Agendar Visita Técnica de Medición ➡️</span>
                <ArrowRight className="h-4 w-4 text-[#F06529]" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* PASO 3: TÉCNICO Y HORARIO (SOLO PARA INSTALACIONES CON MEDICIÓN)  */}
      {/* ================================================================ */}
      {pasoActual === 3 && !esServicioDirecto && (
        <form onSubmit={handleSubmitFinal} className="space-y-5 animate-fade-in">
          <div className="bg-surface p-6 rounded-2xl border border-line shadow-xs space-y-5">
            <div className="border-b border-line-soft pb-3">
              <h3 className="text-sm font-black text-ink uppercase tracking-wider flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#F06529]" />
                Paso 3: ¿Cuándo y qué técnico realizará la visita de medición en terreno?
              </h3>
              <p className="text-xs text-muted mt-0.5">
                El instalador asignado acudirá al domicilio a medir los metros lineales de tubería y verificar la ventilación reglamentaria.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-secondary mb-1">
                  Técnico Asignado {esServicioDirecto ? "(Opcional)" : <span className="text-red-500">*</span>}
                </label>
                <select
                  required={!esServicioDirecto}
                  value={tecnicoId}
                  onChange={(e) => setTecnicoId(e.target.value)}
                  className="w-full p-3 bg-canvas border border-line rounded-xl font-bold text-ink outline-none focus:ring-2 focus:ring-[#F06529]"
                >
                  <option value="">{esServicioDirecto ? "-- (Opcional) Asignar luego --" : "Seleccionar técnico disponible..."}</option>
                  {tecnicos.map((t) => (
                    <option key={t.id} value={t.id}>
                      🔧 {t.nombre} ({t.telefono || "Sin teléfono"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-secondary mb-1">
                  Fecha y Horario Pactado {esServicioDirecto ? "(Opcional)" : <span className="text-red-500">*</span>}
                </label>
                <input
                  type="datetime-local"
                  required={!esServicioDirecto}
                  value={fechaVisita}
                  onChange={(e) => setFechaVisita(e.target.value)}
                  className="w-full p-3 bg-canvas border border-line rounded-xl font-bold text-ink outline-none focus:ring-2 focus:ring-[#F06529]"
                />
              </div>
            </div>

            {/* Atajos Rápidos de Horarios */}
            <div className="space-y-1.5 text-xs">
              <span className="text-[11px] font-bold text-muted block">Atajos rápidos de fecha:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => atajoFecha("hoy_tarde")}
                  className="px-3 py-1.5 rounded-lg bg-wash hover:bg-emphasis text-secondary font-bold text-[11px] cursor-pointer"
                >
                  🕒 Hoy en la Tarde (15:30)
                </button>
                <button
                  type="button"
                  onClick={() => atajoFecha("manana_10")}
                  className="px-3 py-1.5 rounded-lg bg-wash hover:bg-emphasis text-secondary font-bold text-[11px] cursor-pointer"
                >
                  ☀️ Mañana (10:00 AM)
                </button>
                <button
                  type="button"
                  onClick={() => atajoFecha("manana_15")}
                  className="px-3 py-1.5 rounded-lg bg-wash hover:bg-emphasis text-secondary font-bold text-[11px] cursor-pointer"
                >
                  ⛅ Mañana (15:00 PM)
                </button>
              </div>
            </div>

            {/* TARJETA DE RESUMEN FINAL DINÁMICA */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-[#0F2C59] text-white space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF7B42] flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Resumen de la Orden a Crear:
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  esServicioDirecto ? "bg-purple-500/30 text-purple-300 border border-purple-400/40" : "bg-blue-500/30 text-blue-300 border border-blue-400/40"
                }`}>
                  {esServicioDirecto ? "⚡ Modalidad: Tarifa Directa (Sin Medición)" : "📐 Modalidad: Instalación con Levantamiento"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-faint block text-[10px]">Cliente:</span>
                  <p className="font-bold text-white">{formDataCliente.nombreCompleto}</p>
                  <p className="text-slate-300 text-[11px]">{formDataCliente.telefono}</p>
                </div>
                <div>
                  <span className="text-faint block text-[10px]">Dirección:</span>
                  <p className="font-bold text-white">{formDataCliente.direccion}</p>
                </div>
                <div>
                  <span className="text-faint block text-[10px]">Servicio Solicitado:</span>
                  <p className="font-bold text-emerald-300">{serviciosNombresResumen}</p>
                </div>
                <div>
                  <span className="text-faint block text-[10px]">Técnico Asignado:</span>
                  <p className="font-bold text-white">{tecnicoSeleccionadoObj?.nombre || "(Por asignar)"}</p>
                  <p className="text-[#FF7B42] text-[11px]">
                    {fechaVisita ? new Date(fechaVisita).toLocaleString("es-CL") : "(Sin horario fijado)"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Botones de Navegación Final */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setPasoActual(2)}
              className="px-5 py-2.5 border border-line hover:bg-canvas text-secondary rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Volver a Servicios</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-7 py-3 bg-[#F06529] hover:bg-[#D94E15] text-white rounded-xl font-black text-xs shadow-lg flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {saving ? (
                <span>Creando orden...</span>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {esServicioDirecto
                      ? "⚡ Crear Orden y Emitir Presupuesto Inmediato"
                      : "📅 Agendar Visita Técnica de Medición"}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

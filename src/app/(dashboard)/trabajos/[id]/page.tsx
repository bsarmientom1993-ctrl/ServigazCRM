"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Briefcase,
  User,
  Calendar,
  Clock,
  MapPin,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Camera,
  FileText,
  DollarSign,
  Layers,
  ArrowRight,
  ShieldCheck,
  PlusCircle,
  Wrench,
  Sparkles,
  ChevronLeft,
  Printer,
  X,
  CreditCard,
  Percent,
  TrendingUp,
  Award,
  Package,
  QrCode,
  Lock,
  ClipboardCheck,
} from "lucide-react";

export default function TrabajoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.rol === "ADMIN";

  const [trabajo, setTrabajo] = useState<any>(null);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [productosInventario, setProductosInventario] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Modales
  const [modalPdf, setModalPdf] = useState(false);
  const [modalPago, setModalPago] = useState(false);
  const [modalMaterial, setModalMaterial] = useState(false);
  const [modalCierreFinanciero, setModalCierreFinanciero] = useState(false);

  // Fase 4: Agenda state
  const [fase4Data, setFase4Data] = useState({
    tecnicoId: "",
    fechaProgramada: "",
    observaciones: "",
  });

  // Fase 5: Visita state
  const [fase5Data, setFase5Data] = useState({
    metrosVisto: 10,
    metrosEmpotrado: 6,
    condiciones: "Recinto ventilado, acceso despejado por patio lateral",
    ventilacionVasaOk: true,
    dificultadSugerida: 1,
    observaciones: "Trazado estándar sin obstáculos",
    fotosUrls: [
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80",
      "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=400&q=80",
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=400&q=80",
    ],
  });

  // Fase 6: Cotizador embebido
  const [fase6Calculo, setFase6Calculo] = useState({
    subtotalMateriales: 245000,
    subtotalManoObra: 136000,
    montoTransporte: 25000,
    porcentajeDescuento: 0,
    justificacionMargenBajo: "",
  });

  // Fase 8: Pago state
  const [pagoData, setPagoData] = useState({
    monto: 0,
    metodoPago: "TRANSFERENCIA",
    numeroReferencia: "",
  });

  // Fase 9: Material Consumido state
  const [materialData, setMaterialData] = useState({
    descripcion: "",
    cantidad: 1,
    unidad: "un",
    costoUnitario: 0,
    esDeInventario: false,
    productoId: "",
    proveedorNombre: "",
    numeroDocumento: "",
  });

  // Fase 13: Cierre Financiero state
  const [cierreData, setCierreData] = useState({
    costoManoObraReal: 95000,
    costoTransporteReal: 20000,
    otrosEgresosDirectos: 0,
    observacionesCierre: "Trabajo concluido a conformidad",
  });

  const cargarDatos = async () => {
    try {
      // 1. Cargar Trabajo
      const resTrb = await fetch(`/api/trabajos/${id}`);
      const dataTrb = await resTrb.json();

      if (!resTrb.ok || dataTrb.error) {
        setErrorMsg(dataTrb.error || "Trabajo no encontrado");
        setLoading(false);
        return;
      }

      setTrabajo(dataTrb);

      // 2. Cargar Técnicos (Opcional seguro)
      try {
        const resTec = await fetch("/api/tecnicos");
        const dataTec = await resTec.json();
        const tecs = Array.isArray(dataTec) ? dataTec : [];
        setTecnicos(tecs);
        if (tecs.length > 0) {
          setFase4Data((prev) => ({ ...prev, tecnicoId: dataTrb.tecnicoId || tecs[0].id }));
        }
      } catch (e) {
        console.warn("No se pudieron cargar técnicos:", e);
      }

      // 3. Cargar Inventario (Opcional seguro)
      try {
        const resProd = await fetch("/api/inventario");
        const dataProd = await resProd.json();
        setProductosInventario(Array.isArray(dataProd) ? dataProd : []);
      } catch (e) {
        console.warn("No se pudo cargar inventario:", e);
      }

      // Calcular anticipo sugerido
      const cotiz = dataTrb.cotizaciones?.[0];
      if (cotiz) {
        const totalPagado = dataTrb.pagos?.reduce((acc: number, p: any) => acc + Number(p.monto), 0) || 0;
        const anticipoMin = Number(cotiz.anticipoMinimoRequerido || Number(cotiz.totalCotizado) * 0.5);
        setPagoData((p) => ({ ...p, monto: Math.max(0, anticipoMin - totalPagado) }));
      }
    } catch (err: any) {
      console.error("Error cargando orden:", err);
      setErrorMsg(err.message || "Error al conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [id]);

  // Fase 4
  const handleAgendarVisita = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/trabajos/${id}/visita`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "AGENDAR_VISITA", ...fase4Data }),
      });
      if (res.ok) {
        setSuccessMsg("✅ Fase 4 completada: Visita agendada.");
        cargarDatos();
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  // Fase 5
  const handleCompletarVisita = async (e: React.FormEvent) => {
    e.preventDefault();
    const visitaActiva = trabajo?.visitas?.[0];
    try {
      const res = await fetch(`/api/trabajos/${id}/visita`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "COMPLETAR_VISITA",
          visitaId: visitaActiva?.id,
          medidasJson: { metrosVisto: fase5Data.metrosVisto, metrosEmpotrado: fase5Data.metrosEmpotrado },
          condicionesJson: { condiciones: fase5Data.condiciones },
          ventilacionVasaOk: fase5Data.ventilacionVasaOk,
          fotosUrls: fase5Data.fotosUrls,
          dificultadSugerida: fase5Data.dificultadSugerida,
          observaciones: fase5Data.observaciones,
        }),
      });
      if (res.ok) {
        setSuccessMsg("✅ Fase 5 completada: Evaluación registrada (EVALUADO).");
        cargarDatos();
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  // Fase 6
  const handleEmitirCotizacion = async (e: React.FormEvent) => {
    e.preventDefault();
    const subtotalBruto =
      fase6Calculo.subtotalMateriales + fase6Calculo.subtotalManoObra + fase6Calculo.montoTransporte;
    const montoDescuento = (subtotalBruto * fase6Calculo.porcentajeDescuento) / 100;
    const totalCotizado = subtotalBruto - montoDescuento;

    try {
      const res = await fetch(`/api/trabajos/${id}/cotizacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datosFormulario: { trabajo: trabajo.subtipoNombre },
          snapshotCalculo: { subtotalMateriales: fase6Calculo.subtotalMateriales, subtotalManoObra: fase6Calculo.subtotalManoObra },
          subtotalMateriales: fase6Calculo.subtotalMateriales,
          subtotalManoObra: fase6Calculo.subtotalManoObra,
          montoTransporte: fase6Calculo.montoTransporte,
          porcentajeDescuento: fase6Calculo.porcentajeDescuento,
          montoDescuento,
          totalCotizado,
          anticipoMinimo: totalCotizado * 0.5,
          alertaBajoMargen: false,
        }),
      });
      if (res.ok) {
        setSuccessMsg("✅ Fase 6 completada: Cotización emitida con Snapshot.");
        cargarDatos();
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  // Fase 7
  const handleDecisionCliente = async (decision: "APROBAR" | "RECHAZAR") => {
    try {
      const res = await fetch(`/api/trabajos/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (res.ok) {
        setSuccessMsg(decision === "APROBAR" ? "✅ Fase 7: Cliente Aceptó la cotización." : "❌ Trabajo Rechazado.");
        cargarDatos();
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  // Fase 8
  const handleRegistrarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/trabajos/${id}/pagos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pagoData),
      });
      if (res.ok) {
        setSuccessMsg("✅ Fase 8: Pago registrado exitosamente.");
        setModalPago(false);
        cargarDatos();
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  // Fase 9: Iniciar Ejecución
  const handleIniciarEjecucion = async () => {
    try {
      const res = await fetch(`/api/trabajos/${id}/ejecucion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "INICIAR_EJECUCION" }),
      });
      if (res.ok) {
        setSuccessMsg("✅ Trabajo iniciado en terreno. Estado: EN PROCESO.");
        cargarDatos();
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  // Fase 9: Registrar Material Consumido
  const handleRegistrarMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/trabajos/${id}/ejecucion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "REGISTRAR_MATERIAL", data: materialData }),
      });
      if (res.ok) {
        setSuccessMsg("✅ Material consumido registrado y cargado al costo real del trabajo.");
        setModalMaterial(false);
        setMaterialData({
          descripcion: "",
          cantidad: 1,
          unidad: "un",
          costoUnitario: 0,
          esDeInventario: false,
          productoId: "",
          proveedorNombre: "",
          numeroDocumento: "",
        });
        cargarDatos();
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  // Fase 11: Término Técnico
  const handleFinalizarTecnico = async () => {
    try {
      const res = await fetch(`/api/trabajos/${id}/ejecucion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "FINALIZAR_TECNICO",
          data: {
            fotosTermino: [
              "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80",
              "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=400&q=80",
            ],
            observacionesTermino: "Instalación completada y probada bajo presión reglamentaria",
          },
        }),
      });
      if (res.ok) {
        setSuccessMsg("✅ Trabajo técnico terminado. Listo para aprobación de calidad.");
        cargarDatos();
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  // Fase 12: Validación Encargado
  const handleValidarEncargado = async () => {
    try {
      const res = await fetch(`/api/trabajos/${id}/ejecucion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "VALIDAR_ENCARGADO" }),
      });
      if (res.ok) {
        setSuccessMsg("✅ Fase 12 completada: Conformidad y calidad aprobada por el Encargado.");
        cargarDatos();
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  // Finalización del Trabajo y Cálculo de Ganancia
  const handleCierreFinanciero = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/trabajos/${id}/cierre-financiero`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cierreData),
      });
      const data = await res.json();
      if (res.ok) {
        setErrorMsg("");
        setSuccessMsg(`✅ Trabajo finalizado con éxito. Certificado de Garantía con QR emitido. Ganancia Real: Bs. ${Number(data.utilidadReal || 0).toLocaleString("es-CL")}`);
        setModalCierreFinanciero(false);
        cargarDatos();
      } else {
        setErrorMsg(data.error);
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500 font-semibold text-xs">Cargando orden de trabajo...</div>;
  if (!trabajo) return <div className="p-8 text-center text-red-600 font-bold">{errorMsg || "Trabajo no encontrado"}</div>;

  const isGas = trabajo.subtipoCodigo?.toLowerCase().includes("gas") || trabajo.subtipoNombre?.toLowerCase().includes("gas");
  const estado = trabajo.estado;
  const cotizacionVigente = trabajo.cotizaciones?.[0];
  const garantia = trabajo.garantia;

  const totalPagado = trabajo.pagos?.reduce((acc: number, p: any) => acc + Number(p.monto), 0) || 0;
  const totalCotizado = Number(cotizacionVigente?.totalCotizado || 0);
  const saldoPendiente = Math.max(0, totalCotizado - totalPagado);
  const porcentajePagado = totalCotizado > 0 ? Math.min(100, Math.round((totalPagado / totalCotizado) * 100)) : 0;

  const totalMaterialesReales = trabajo.materiales?.reduce((acc: number, m: any) => acc + Number(m.subtotalCosto), 0) || 0;

  const esSimplificado = trabajo.tipoFlujo === "SIMPLIFICADO";

  const steps = esSimplificado
    ? [
        { label: "1. Recepción & Tarifa", done: true },
        { label: "2. Presupuesto", done: !["BORRADOR"].includes(estado) },
        { label: "3. Pago / Cobro", done: ["ANTICIPO_RECIBIDO", "EN_PROCESO", "TERMINADO_TECNICO", "VALIDADO", "FINALIZADO_FINANCIERO", "ARCHIVADO"].includes(estado) },
        { label: "4. Realización del Trabajo", done: ["EN_PROCESO", "TERMINADO_TECNICO", "VALIDADO", "FINALIZADO_FINANCIERO", "ARCHIVADO"].includes(estado) },
        { label: "5. Finalización & Garantía", done: ["FINALIZADO_FINANCIERO", "ARCHIVADO"].includes(estado) },
      ]
    : [
        { label: "1. Registro", done: true },
        { label: "2. Agenda de Visita", done: estado !== "BORRADOR" },
        { label: "3. Medición en Terreno", done: !["BORRADOR", "EVALUACION_PENDIENTE"].includes(estado) },
        { label: "4. Presupuesto (Bs.)", done: !["BORRADOR", "EVALUACION_PENDIENTE", "EVALUADO"].includes(estado) },
        { label: "5. Aceptación del Cliente", done: ["APROBADO", "ANTICIPO_RECIBIDO", "EN_PROCESO", "TERMINADO_TECNICO", "VALIDADO", "FINALIZADO_FINANCIERO", "ARCHIVADO"].includes(estado) },
        { label: "6. Anticipo (50%)", done: ["ANTICIPO_RECIBIDO", "EN_PROCESO", "TERMINADO_TECNICO", "VALIDADO", "FINALIZADO_FINANCIERO", "ARCHIVADO"].includes(estado) },
        { label: "7. En Trabajo", done: ["EN_PROCESO", "TERMINADO_TECNICO", "VALIDADO", "FINALIZADO_FINANCIERO", "ARCHIVADO"].includes(estado) },
        { label: "8. Finalización & Garantía", done: ["FINALIZADO_FINANCIERO", "ARCHIVADO"].includes(estado) },
      ];



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <Link href="/trabajos" className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-[#0F2C59] tracking-tight">{trabajo.codigoCorrelativo}</h2>
              <span className="text-xs font-bold px-3 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                {trabajo.estado}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {trabajo.subtipoNombre} • Cliente: <strong>{trabajo.cliente?.nombreCompleto}</strong>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {cotizacionVigente && (
            <button
              onClick={() => setModalPdf(true)}
              className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-[#0F2C59]" />
              <span>Ver Cotización (PDF)</span>
            </button>
          )}

          {["COTIZADO", "APROBADO", "ANTICIPO_RECIBIDO", "EN_PROCESO", "TERMINADO_TECNICO", "VALIDADO"].includes(estado) && (
            <button
              onClick={() => setModalPago(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>💵 Registrar Pago {saldoPendiente > 0 ? `(Bs. ${saldoPendiente.toLocaleString("es-CL")})` : ""}</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
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

      {/* Timeline */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
        <div className="flex items-center justify-between min-w-[750px] gap-2">
          {steps.map((s, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center text-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  s.done ? "bg-[#0F2C59] text-white shadow-xs" : "bg-slate-100 text-slate-400 border border-slate-200"
                }`}
              >
                {idx + 1}
              </div>
              <span className={`text-[10px] mt-1.5 font-bold ${s.done ? "text-[#0F2C59]" : "text-slate-400"}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <User className="h-4 w-4 text-[#F06529]" /> Datos del Cliente
            </h3>
            <div>
              <p className="text-sm font-black text-slate-900">{trabajo.cliente?.nombreCompleto}</p>
              <span className="inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                Fidelización: {trabajo.cliente?.nivelFidelizacion}
              </span>
            </div>
            <div className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
              <p className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-[#0F2C59] shrink-0" />
                <span>{trabajo.cliente?.direccion}</span>
              </p>
            </div>
          </div>

          {/* Certificado de Garantía (Fase 14) */}
          {garantia && (
            <div className="bg-gradient-to-br from-emerald-900 to-[#0F2C59] text-white p-5 rounded-2xl shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4" /> Certificado Garantía Oficial (#89)
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">
                  {garantia.estado}
                </span>
              </div>

              <div className="p-3 bg-white/10 rounded-xl space-y-1 text-xs">
                <p className="font-mono text-[11px] text-emerald-200 font-bold">{garantia.codigoCertificado || garantia.codigoQR}</p>
                <p className="text-[11px] text-slate-300">
                  Vigencia: {new Date(garantia.fechaInicio).toLocaleDateString("es-CL")} al {new Date(garantia.fechaFin || garantia.fechaVencimiento).toLocaleDateString("es-CL")} ({garantia.mesesCobertura || 12} meses)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* FASE 4 */}
          {estado === "BORRADOR" && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-black text-[#0F2C59] uppercase tracking-wider flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#F06529]" /> Fase 4: Agenda y Asignación de Visita Técnica
              </h3>
              <form onSubmit={handleAgendarVisita} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Técnico Instalador</label>
                    <select
                      required
                      value={fase4Data.tecnicoId}
                      onChange={(e) => setFase4Data({ ...fase4Data, tecnicoId: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
                    >
                      <option value="">Seleccionar técnico...</option>
                      {tecnicos.map((t) => (
                        <option key={t.id} value={t.id}>{t.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Fecha Programada</label>
                    <input
                      type="datetime-local"
                      required
                      value={fase4Data.fechaProgramada}
                      onChange={(e) => setFase4Data({ ...fase4Data, fechaProgramada: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
                    />
                  </div>
                </div>
                <button type="submit" className="px-5 py-2.5 bg-[#F06529] hover:bg-[#D94E15] text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 cursor-pointer">
                  <span>Confirmar Agenda</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          )}

          {/* FASE 5: MEDICIÓN EN TERRENO */}
          {estado === "EVALUACION_PENDIENTE" && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-[#0F2C59] uppercase tracking-wider flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-[#F06529]" /> 📏 Paso del Técnico: Medición en Casa/Obra del Cliente
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    El instalador asignado ({trabajo.tecnico?.nombre || "Técnico"}) anota los metros de tubería y dificultad en el lugar.
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                  Visita Asignada
                </span>
              </div>

              <form onSubmit={handleCompletarVisita} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Metros de tubería por fuera / vista (m)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={fase5Data.metrosVisto}
                      onChange={(e) => setFase5Data({ ...fase5Data, metrosVisto: Number(e.target.value) })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-[#F06529]"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Tubería que va con abrazaderas o grampas</span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Metros de tubería picada en la pared / empotrada (m)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={fase5Data.metrosEmpotrado}
                      onChange={(e) => setFase5Data({ ...fase5Data, metrosEmpotrado: Number(e.target.value) })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-[#F06529]"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Tubería oculta bajo revoque o piso</span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Dificultad del Trabajo</label>
                    <select
                      value={fase5Data.dificultadSugerida}
                      onChange={(e) => setFase5Data({ ...fase5Data, dificultadSugerida: Number(e.target.value) })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none"
                    >
                      <option value={1}>Nivel 1 (Normal / Fácil)</option>
                      <option value={2}>Nivel 2 (Medio / Altura moderada)</option>
                      <option value={3}>Nivel 3 (Complejo / Muros gruesos)</option>
                      <option value={4}>Nivel 4 (Muy Difícil - Requiere ayudante extra)</option>
                      <option value={5}>Nivel 5 (Extremo - Alto riesgo)</option>
                    </select>
                  </div>

                  {isGas && (
                    <div className="flex items-center gap-2.5 pt-6">
                      <input
                        type="checkbox"
                        id="vasaCheck"
                        checked={fase5Data.ventilacionVasaOk}
                        onChange={(e) => setFase5Data({ ...fase5Data, ventilacionVasaOk: e.target.checked })}
                        className="w-4 h-4 accent-[#F06529] rounded cursor-pointer"
                      />
                      <label htmlFor="vasaCheck" className="font-bold text-slate-800 cursor-pointer">
                        Rejillas y ventilación de gas seguras y reglamentarias
                      </label>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Guardar Mediciones & Enviar al Encargado</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* FASE 6: EMISIÓN DE COTIZACIÓN POR EL ENCARGADO */}
          {estado === "EVALUADO" && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-[#0F2C59] uppercase tracking-wider flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-[#F06529]" /> 📄 Presupuesto Oficial para el Cliente
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    El técnico terminó de medir. Revisa los costos calculados en Bolivianos (Bs.) y genera el presupuesto final.
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                  Listo para Presupuestar
                </span>
              </div>

              <form onSubmit={handleEmitirCotizacion} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Costo de Materiales (Bs.)</label>
                    <input
                      type="number"
                      value={fase6Calculo.subtotalMateriales}
                      onChange={(e) => setFase6Calculo({ ...fase6Calculo, subtotalMateriales: Number(e.target.value) })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Costo de Mano de Obra (Bs.)</label>
                    <input
                      type="number"
                      value={fase6Calculo.subtotalManoObra}
                      onChange={(e) => setFase6Calculo({ ...fase6Calculo, subtotalManoObra: Number(e.target.value) })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Transporte / Movilidad (Bs.)</label>
                    <input
                      type="number"
                      value={fase6Calculo.montoTransporte}
                      onChange={(e) => setFase6Calculo({ ...fase6Calculo, montoTransporte: Number(e.target.value) })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#F06529] hover:bg-[#D94E15] text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Guardar y Emitir Presupuesto Oficial</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* FASE 7: ENVÍO AL CLIENTE (WHATSAPP / PDF) & DECISIÓN */}
          {estado === "COTIZADO" && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-[#0F2C59] uppercase tracking-wider flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#F06529]" /> 📱 Enviar Presupuesto al Cliente y Registrar Respuesta
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Presupuesto vigente por un total de <strong>Bs. {totalCotizado.toLocaleString("es-CL")}</strong>.
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800">
                  Válido por 15 Días
                </span>
              </div>

              {/* Botones de Envío al Cliente */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                <span className="font-bold text-slate-700 block">Enviar presupuesto al cliente:</span>
                <div className="flex flex-wrap items-center gap-2.5">
                  <a
                    href={`https://api.whatsapp.com/send?phone=${encodeURIComponent(
                      (Array.isArray(trabajo.cliente?.telefonos) ? trabajo.cliente?.telefonos[0] : trabajo.cliente?.telefonos) || "+59170000000"
                    )}&text=${encodeURIComponent(
                      `Hola ${trabajo.cliente?.nombreCompleto}, le saludamos de SERVIGAZ. Le enviamos la cotización oficial para su servicio de ${trabajo.subtipoNombre} por un total de Bs. ${totalCotizado.toLocaleString("es-CL")}. Anticipo requerido (50%): Bs. ${(totalCotizado * 0.5).toLocaleString("es-CL")}. Quedamos atentos a su confirmación.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <span>📱 Enviar por WhatsApp al Cliente</span>
                  </a>

                  <button
                    onClick={() => setModalPdf(true)}
                    className="px-4 py-2 bg-[#0F2C59] hover:bg-[#1A3E72] text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Ver / Descargar Presupuesto PDF</span>
                  </button>
                </div>
              </div>

              {/* Registro de Decisión */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-500 font-medium">
                  ¿Qué respondió el cliente?
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDecisionCliente("RECHAZAR")}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl border border-red-200 cursor-pointer"
                  >
                    Cliente Rechaza
                  </button>
                  <button
                    onClick={() => handleDecisionCliente("APROBAR")}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Cliente Acepta el Trabajo</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ESTADO APROBADO: REGISTRAR PAGO O INICIAR DIRECTAMENTE */}
          {estado === "APROBADO" && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-[#0F2C59] uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Presupuesto Aceptado por el Cliente
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    El cliente aprobó la cotización de <strong>Bs. {totalCotizado.toLocaleString("es-CL")}</strong>.
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                  Aprobado
                </span>
              </div>

              {/* Opciones directas: Registrar Pago o Iniciar Directamente */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                <span className="font-bold text-slate-700 block">
                  ¿Cómo deseas continuar con la orden?
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setModalPago(true)}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <DollarSign className="h-4 w-4" />
                    <span>💵 Registrar Cobro / Anticipo (Bs.)</span>
                  </button>

                  <button
                    onClick={handleIniciarEjecucion}
                    className="px-5 py-2.5 bg-[#0F2C59] hover:bg-[#1A3E72] text-white font-bold rounded-xl flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Wrench className="h-4 w-4 text-[#F06529]" />
                    <span>▶️ Comenzar el Trabajo / Entrega Directa</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* FASE 8: ANTICIPO APROBADO -> INICIAR TRABAJO */}
          {estado === "ANTICIPO_RECIBIDO" && (
            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-200 shadow-xs space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-emerald-900 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Anticipo Confirmado (50%)
                  </h3>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    El cliente pagó el anticipo requerido. El trabajo está listo para realizarse.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleIniciarEjecucion}
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Wrench className="h-4 w-4" />
                  <span>Comenzar el Trabajo</span>
                </button>
              </div>
            </div>
          )}

          {/* FASE 9, 10, 11, 12, 13: EJECUCIÓN Y CONTROL DE MATERIALES / REPUESTOS / HERRAMIENTAS */}
          {["EN_PROCESO", "TERMINADO_TECNICO", "VALIDADO", "FINALIZADO_FINANCIERO"].includes(estado) && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-black text-[#0F2C59] uppercase tracking-wider flex items-center gap-2">
                    {trabajo.subtipoCodigo?.toLowerCase().includes("alquiler") || trabajo.subtipoCodigo?.startsWith("OTR.3") || trabajo.subtipoNombre?.toLowerCase().includes("alquiler") ? (
                      <>
                        <Wrench className="h-4 w-4 text-[#F06529]" /> 🛠️ Herramientas y Equipos en Alquiler
                      </>
                    ) : trabajo.subtipoCodigo?.startsWith("OTR") || trabajo.subtipoNombre?.toLowerCase().includes("hermeticidad") || trabajo.subtipoNombre?.toLowerCase().includes("trámite") ? (
                      <>
                        <ClipboardCheck className="h-4 w-4 text-[#F06529]" /> 📋 Registro de la Prueba / Servicio Técnico
                      </>
                    ) : trabajo.subtipoCodigo?.startsWith("3.") || trabajo.subtipoNombre?.toLowerCase().includes("calef") || trabajo.subtipoNombre?.toLowerCase().includes("equipo") ? (
                      <>
                        <Wrench className="h-4 w-4 text-[#F06529]" /> 🔧 Repuestos Utilizados en el Equipo
                      </>
                    ) : (
                      <>
                        <Layers className="h-4 w-4 text-[#F06529]" /> 🏗️ Materiales y Cañerías Utilizadas
                      </>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {trabajo.subtipoCodigo?.toLowerCase().includes("alquiler") || trabajo.subtipoCodigo?.startsWith("OTR.3") || trabajo.subtipoNombre?.toLowerCase().includes("alquiler")
                      ? "Herramientas o equipos entregados al cliente bajo contrato de alquiler (termofusoras, bombas, etc.)."
                      : trabajo.subtipoCodigo?.startsWith("OTR") || trabajo.subtipoNombre?.toLowerCase().includes("hermeticidad") || trabajo.subtipoNombre?.toLowerCase().includes("trámite")
                      ? "Servicio puntual de prueba de hermeticidad o trámite SEC (no requiere cañerías ni materiales de obra obligatorios)."
                      : trabajo.subtipoCodigo?.startsWith("3.") || trabajo.subtipoNombre?.toLowerCase().includes("calef") || trabajo.subtipoNombre?.toLowerCase().includes("equipo")
                      ? "Anota si se utilizaron repuestos de la tienda (se descuenta stock) o comprados afuera."
                      : "Anota las cañerías y accesorios sacados de la tienda o comprados afuera para la instalación."}
                  </p>
                </div>

                {estado === "EN_PROCESO" && (
                  <button
                    onClick={() => {
                      setMaterialData({
                        descripcion: "",
                        cantidad: 1,
                        unidad: "un",
                        costoUnitario: 0,
                        esDeInventario: true,
                        productoId: "",
                        proveedorNombre: "",
                        numeroDocumento: "",
                      });
                      setModalMaterial(true);
                    }}
                    className="px-4 py-2 bg-[#F06529] hover:bg-[#D94E15] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <PlusCircle className="h-4 w-4" />
                    <span>
                      {trabajo.subtipoCodigo?.toLowerCase().includes("alquiler") || trabajo.subtipoCodigo?.startsWith("OTR.3") || trabajo.subtipoNombre?.toLowerCase().includes("alquiler")
                        ? "+ Registrar Herramienta / Insumo"
                        : trabajo.subtipoCodigo?.startsWith("OTR") || trabajo.subtipoNombre?.toLowerCase().includes("hermeticidad") || trabajo.subtipoNombre?.toLowerCase().includes("trámite")
                        ? "+ Agregar Insumo / Instrumento"
                        : trabajo.subtipoCodigo?.startsWith("3.") || trabajo.subtipoNombre?.toLowerCase().includes("calef") || trabajo.subtipoNombre?.toLowerCase().includes("equipo")
                        ? "+ Agregar Repuesto"
                        : "+ Agregar Material"}
                    </span>
                  </button>
                )}
              </div>

              {/* Tabla de Materiales / Repuestos / Herramientas */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  {trabajo.subtipoCodigo?.toLowerCase().includes("alquiler") || trabajo.subtipoCodigo?.startsWith("OTR.3") || trabajo.subtipoNombre?.toLowerCase().includes("alquiler")
                    ? `Herramientas e insumos registrados (${trabajo.materiales?.length || 0}):`
                    : trabajo.subtipoCodigo?.startsWith("OTR") || trabajo.subtipoNombre?.toLowerCase().includes("hermeticidad")
                    ? `Insumos e instrumentos de prueba (${trabajo.materiales?.length || 0}):`
                    : trabajo.subtipoCodigo?.startsWith("3.") || trabajo.subtipoNombre?.toLowerCase().includes("calef") || trabajo.subtipoNombre?.toLowerCase().includes("equipo")
                    ? `Lista de repuestos cambiados (${trabajo.materiales?.length || 0}):`
                    : `Lista de materiales de obra (${trabajo.materiales?.length || 0}):`}
                </span>

                {trabajo.materiales?.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                    {trabajo.subtipoCodigo?.toLowerCase().includes("alquiler") || trabajo.subtipoCodigo?.startsWith("OTR.3") || trabajo.subtipoNombre?.toLowerCase().includes("alquiler")
                      ? "Herramientas asignadas para el alquiler. Al finalizar el período o devolver los equipos, presiona 'Trabajo Físico Terminado'."
                      : trabajo.subtipoCodigo?.startsWith("OTR") || trabajo.subtipoNombre?.toLowerCase().includes("hermeticidad") || trabajo.subtipoNombre?.toLowerCase().includes("trámite")
                      ? "No se requieren materiales de obra para esta prueba o servicio. Puedes presionar 'Trabajo Físico Terminado' al concluir el ensayo."
                      : trabajo.subtipoCodigo?.startsWith("3.") || trabajo.subtipoNombre?.toLowerCase().includes("calef") || trabajo.subtipoNombre?.toLowerCase().includes("equipo")
                      ? "No se cambiaron repuestos (solo mano de obra / ajuste). Si terminaste la revisión, presiona 'Trabajo Físico Terminado'."
                      : "No se han registrado materiales todavía. Presiona el botón naranja de arriba para agregar uno."}
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Descripción</th>
                          <th className="py-2.5 px-3">Origen</th>
                          <th className="py-2.5 px-3 text-right">Cant.</th>
                          <th className="py-2.5 px-3 text-right">Costo Unit. (Bs.)</th>
                          <th className="py-2.5 px-3 text-right">Subtotal (Bs.)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {trabajo.materiales?.map((m: any) => (
                          <tr key={m.id}>
                            <td className="py-2.5 px-3 font-bold text-slate-900">{m.descripcion}</td>
                            <td className="py-2.5 px-3">
                              {m.tipoOrigen === "INVENTARIO" || m.esDeInventario ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                                  🏢 Tienda Servigaz
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                                  🛒 Comprado Afuera
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">{Number(m.cantidad)}</td>
                            <td className="py-2.5 px-3 text-right font-mono">Bs. {Number(m.costoUnitario).toLocaleString("es-CL")}</td>
                            <td className="py-2.5 px-3 text-right font-black text-[#0F2C59]">Bs. {Number(m.subtotalCosto).toLocaleString("es-CL")}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t border-slate-200 font-black text-slate-900">
                        <tr>
                          <td colSpan={4} className="py-2.5 px-3 text-right uppercase text-[10px]">
                            {trabajo.subtipoCodigo?.startsWith("3.") || trabajo.subtipoNombre?.toLowerCase().includes("calef") || trabajo.subtipoNombre?.toLowerCase().includes("equipo")
                              ? "Total Gastado en Repuestos:"
                              : "Total Gastado en Materiales:"}
                          </td>
                          <td className="py-2.5 px-3 text-right text-sm text-[#F06529]">Bs. {totalMaterialesReales.toLocaleString("es-CL")}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Botones de Transición de Fases */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500 font-medium">
                  {estado === "EN_PROCESO" && "👉 Trabajo en curso. Cuando el técnico termine en el lugar, presiona 'Trabajo Físico Terminado'."}
                  {estado === "TERMINADO_TECNICO" && "👉 El técnico terminó. El Encargado debe revisar y presionar 'Aprobar Calidad del Trabajo'."}
                  {estado === "VALIDADO" && "👉 Trabajo aprobado. Presiona 'Finalizar Trabajo y Ver Ganancia' para emitir la garantía oficial con QR."}
                  {estado === "FINALIZADO_FINANCIERO" && "✅ Trabajo finalizado con éxito. Garantía oficial activa."}
                </span>

                {estado === "EN_PROCESO" && (
                  <button
                    onClick={handleFinalizarTecnico}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    <Camera className="h-4 w-4" />
                    <span>Trabajo Físico Terminado</span>
                  </button>
                )}

                {estado === "TERMINADO_TECNICO" && (
                  <button
                    onClick={handleValidarEncargado}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Aprobar Calidad del Trabajo</span>
                  </button>
                )}

                {estado === "VALIDADO" && (
                  <button
                    onClick={() => setModalCierreFinanciero(true)}
                    className="px-6 py-2.5 bg-[#0F2C59] hover:bg-[#1A3E72] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    <Lock className="h-4 w-4 text-[#F06529]" />
                    <span>Finalizar Trabajo y Ver Ganancia</span>
                  </button>
                )}

                {estado === "FINALIZADO_FINANCIERO" && (
                  <div className="p-3 rounded-xl bg-emerald-100 text-emerald-900 text-xs font-bold flex items-center gap-1.5 shrink-0">
                    <Lock className="h-4 w-4 text-emerald-700" />
                    <span>Trabajo Finalizado con Garantía QR</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE MATERIALES / REPUESTOS CON DESCUENTO DE STOCK EN TIENDA */}
      {modalMaterial && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-[#0F2C59] flex items-center gap-1.5">
                  {trabajo.subtipoCodigo?.startsWith("3.") || trabajo.subtipoNombre?.toLowerCase().includes("calef") || trabajo.subtipoNombre?.toLowerCase().includes("equipo") ? (
                    <>
                      <Wrench className="h-4 w-4 text-[#F06529]" /> 🔧 Agregar Repuesto para el Equipo
                    </>
                  ) : (
                    <>
                      <Package className="h-4 w-4 text-[#F06529]" /> 🏗️ Agregar Material para la Instalación
                    </>
                  )}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Selecciona si el ítem sale de la tienda Servigaz (descontará inventario) o si se compró afuera.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if ((materialData.descripcion.trim() || materialData.productoId) && !window.confirm("¿Deseas salir? El material o repuesto que estabas escribiendo no se guardará.")) {
                    return;
                  }
                  setModalMaterial(false);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRegistrarMaterial} className="space-y-4 text-xs">
              {/* Selector de Origen en 2 Tarjetas */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMaterialData({ ...materialData, esDeInventario: true, descripcion: "", productoId: "" })}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    materialData.esDeInventario
                      ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <span>🏢 Tienda / Almacén</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 block mt-0.5 font-semibold">
                    ⚡ Descuenta stock en vivo
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMaterialData({ ...materialData, esDeInventario: false, productoId: "", costoUnitario: 0 })}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    !materialData.esDeInventario
                      ? "border-[#F06529] bg-orange-50 text-orange-950 ring-2 ring-[#F06529]"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <span>🛒 Comprado Afuera</span>
                  </div>
                  <span className="text-[10px] text-orange-700 block mt-0.5 font-semibold">
                    Ferretería / Proveedor externo
                  </span>
                </button>
              </div>

              {materialData.esDeInventario ? (
                <div className="space-y-2">
                  <label className="block font-bold text-slate-700">
                    Seleccionar Producto del Inventario de la Tienda <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={materialData.productoId}
                    onChange={(e) => {
                      const prod = productosInventario.find((p) => p.id === e.target.value);
                      setMaterialData({
                        ...materialData,
                        productoId: e.target.value,
                        descripcion: prod?.nombre || "",
                        unidad: prod?.unidadMedida || prod?.unidad || "un",
                        costoUnitario: Number(prod?.costoPromedio || prod?.precioVenta || 0),
                      });
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Elige un producto en existencia --</option>
                    {productosInventario.map((p) => (
                      <option key={p.id} value={p.id} disabled={p.stockActual <= 0}>
                        {p.nombre} — [Stock: {p.stockActual} {p.unidadMedida || p.unidad || "un"}] — Costo: Bs. {Number(p.costoPromedio || 0).toLocaleString("es-CL")}
                      </option>
                    ))}
                  </select>

                  {materialData.productoId && (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-center justify-between">
                      <span>Stock disponible en tienda:</span>
                      <strong className="text-emerald-950 font-black">
                        {productosInventario.find((p) => p.id === materialData.productoId)?.stockActual}{" "}
                        {productosInventario.find((p) => p.id === materialData.productoId)?.unidadMedida || "un"}
                      </strong>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">
                    Nombre del Material o Repuesto <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    value={materialData.descripcion}
                    onChange={(e) => setMaterialData({ ...materialData, descripcion: e.target.value })}
                    placeholder={
                      trabajo.subtipoCodigo?.startsWith("3.") || trabajo.subtipoNombre?.toLowerCase().includes("calef") || trabajo.subtipoNombre?.toLowerCase().includes("equipo")
                        ? "Ej: Termocupla Universal, Membrana de calefón 14L, Sensor de llama..."
                        : "Ej: Codo de Cobre 1/2, Teflón de gas, Válvula de bola..."
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#F06529]"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cantidad Utilizada <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    required
                    value={materialData.cantidad}
                    onChange={(e) => setMaterialData({ ...materialData, cantidad: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Costo Unitario (Bs.) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={materialData.costoUnitario}
                    onChange={(e) => setMaterialData({ ...materialData, costoUnitario: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Subtotal Calculado */}
              <div className="p-3 bg-slate-100 rounded-xl flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Subtotal de este ítem:</span>
                <span className="text-sm font-black text-[#0F2C59]">
                  Bs. {(Number(materialData.cantidad || 0) * Number(materialData.costoUnitario || 0)).toLocaleString("es-CL")}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if ((materialData.descripcion.trim() || materialData.productoId) && !window.confirm("¿Deseas salir? El material o repuesto que estabas escribiendo no se guardará.")) {
                      return;
                    }
                    setModalMaterial(false);
                  }}
                  className="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#F06529] hover:bg-[#D94E15] text-white rounded-xl font-black shadow-md cursor-pointer transition-all"
                >
                  {materialData.esDeInventario ? "Descontar de Tienda & Guardar" : "Registrar Compra Externa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CIERRE FINANCIERO (FASE 13) */}
      {modalCierreFinanciero && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-[#0F2C59] flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-[#F06529]" /> Finalizar Trabajo y Calcular Ganancia
              </h3>
              <button onClick={() => setModalCierreFinanciero(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCierreFinanciero} className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Cobrado al Cliente:</span>
                  <span className="font-black text-emerald-700">Bs. {totalPagado.toLocaleString("es-CL")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Gastado en Materiales:</span>
                  <span className="font-bold text-slate-800">Bs. {totalMaterialesReales.toLocaleString("es-CL")}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Pago Real de Mano de Obra al Instalador (Bs.)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={cierreData.costoManoObraReal}
                  onChange={(e) => setCierreData({ ...cierreData, costoManoObraReal: Number(e.target.value) })}
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Gasto Real de Transporte / Pasajes (Bs.)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={cierreData.costoTransporteReal}
                  onChange={(e) => setCierreData({ ...cierreData, costoTransporteReal: Number(e.target.value) })}
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setModalCierreFinanciero(false)} className="px-4 py-2 border rounded-xl font-bold text-slate-600">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold">
                  Finalizar Trabajo y Emitir Garantía QR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PAGO CON MÚLTIPLES MÉTODOS (EFECTIVO, TRANSFERENCIA, QR, TARJETA) */}
      {modalPago && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-[#0F2C59] flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4 text-[#F06529]" /> Registrar Pago / Cobro
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Registra el abono del cliente en efectivo, transferencia o QR.
                </p>
              </div>
              <button onClick={() => setModalPago(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRegistrarPago} className="space-y-4 text-xs">
              {/* Resumen de Saldo */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block text-[10px]">Saldo Pendiente:</span>
                  <strong className="text-sm font-black text-slate-900">
                    Bs. {saldoPendiente > 0 ? saldoPendiente.toLocaleString("es-CL") : totalCotizado.toLocaleString("es-CL")}
                  </strong>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  En Bolivianos (Bs.)
                </span>
              </div>

              {/* Selector de Método de Pago */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Forma de Pago:</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "EFECTIVO", label: "💵 Efectivo" },
                    { id: "QR", label: "📲 Pago QR" },
                    { id: "TRANSFERENCIA", label: "🏦 Transferencia" },
                    { id: "TARJETA", label: "💳 Tarjeta" },
                    { id: "CHEQUE", label: "📄 Cheque" },
                    { id: "OTRO", label: "⚙️ Otro" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPagoData({ ...pagoData, metodoPago: m.id })}
                      className={`p-2 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                        pagoData.metodoPago === m.id
                          ? "border-[#F06529] bg-orange-50 text-[#F06529] ring-2 ring-[#F06529]"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Monto */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Monto a Cobrar (Bs.) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={pagoData.monto || ""}
                  onChange={(e) => setPagoData({ ...pagoData, monto: Number(e.target.value) })}
                  placeholder={`Ej: ${saldoPendiente > 0 ? saldoPendiente : totalCotizado}`}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-black text-slate-900 text-sm outline-none focus:ring-2 focus:ring-[#F06529]"
                />
              </div>

              {/* Nro de Referencia / Comprobante */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">N° de Comprobante / Referencia (Opcional)</label>
                <input
                  type="text"
                  value={pagoData.numeroReferencia || ""}
                  onChange={(e) => setPagoData({ ...pagoData, numeroReferencia: e.target.value })}
                  placeholder="Ej: Transf #98214 / QR BCP / Recibo #042"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 outline-none focus:ring-2 focus:ring-[#F06529]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setModalPago(false)} className="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black shadow-md cursor-pointer transition-all">
                  Confirmar Cobro (Bs.)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PDF */}
      {modalPdf && cotizacionVigente && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden my-8">
            <div className="bg-[#0F2C59] text-white p-6 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#FF7B42] uppercase tracking-wider block">Presupuesto Oficial</span>
                <h2 className="text-xl font-black">SERVIGAZ • Equipos e Instalaciones</h2>
                <p className="text-[11px] text-slate-300">NIT: 102938475 • contacto@servigaz.bo</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold px-3 py-1 bg-white/10 rounded-lg block">COT-{trabajo.codigoCorrelativo}</span>
              </div>
            </div>
            <div className="p-6 space-y-6 text-xs text-slate-800">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800">{trabajo.subtipoNombre}</p>
              </div>
              <div className="text-right font-black text-lg text-[#0F2C59]">
                Total: Bs. {totalCotizado.toLocaleString("es-CL")}
              </div>
            </div>
            <div className="p-4 bg-slate-100 border-t flex justify-between">
              <button onClick={() => setModalPdf(false)} className="px-4 py-2 bg-white border rounded-xl font-bold text-xs text-slate-700">Cerrar</button>
              <button onClick={() => window.print()} className="px-5 py-2 bg-[#0F2C59] text-white rounded-xl font-bold text-xs flex items-center gap-1.5">
                <Printer className="h-4 w-4" /> Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

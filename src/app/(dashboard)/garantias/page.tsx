"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  ShieldCheck,
  QrCode,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  PlusCircle,
  Wrench,
  FileText,
  User,
  MapPin,
  Calendar,
  X,
  Sparkles,
  Printer,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

export default function GarantiasPage() {
  const { user } = useAuth();
  const isAdmin = user?.rol === "ADMIN";
  const claimRequest = useRef({key:"",snapshot:""});

  const [tabActiva, setTabActiva] = useState<"certificados" | "reclamos">("certificados");
  const [certificados, setCertificados] = useState<any[]>([]);
  const [reclamos, setReclamos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [msgExito, setMsgExito] = useState("");

  // Modales
  const [modalCertificado, setModalCertificado] = useState(false);
  const [certSeleccionado, setCertSeleccionado] = useState<any>(null);

  const [modalNuevoReclamo, setModalNuevoReclamo] = useState(false);
  const [nuevoReclamoData, setNuevoReclamoData] = useState({
    trabajoOriginalId: "",
    descripcionFalla: "",
  });

  const [modalDictamen, setModalDictamen] = useState(false);
  const [reclamoEditando, setReclamoEditando] = useState<any>(null);
  const [dictamenData, setDictamenData] = useState({
    procedeGarantia: true,
    solucionDetalle: "",
  });

  const cargarGarantias = async () => {
    try {
      const res = await fetch("/api/garantias");
      const data = await res.json();
      setCertificados(Array.isArray(data.certificados) ? data.certificados : []);
      setReclamos(Array.isArray(data.reclamos) ? data.reclamos : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarGarantias();
  }, []);

  const handleCrearReclamo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const snapshot=JSON.stringify(nuevoReclamoData);
      if(claimRequest.current.snapshot!==snapshot)claimRequest.current={key:crypto.randomUUID(),snapshot};
      const res = await fetch("/api/recepcion/reclamos", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key":claimRequest.current.key },
        body: JSON.stringify({
          trabajoId: nuevoReclamoData.trabajoOriginalId,
          descripcionFalla: nuevoReclamoData.descripcionFalla,
        }),
      });

      if (res.ok) {
        setMsgExito("✅ Reclamo de post-venta ingresado exitosamente.");
        claimRequest.current={key:"",snapshot:""};
        setModalNuevoReclamo(false);
        setNuevoReclamoData({ trabajoOriginalId: "", descripcionFalla: "" });
        cargarGarantias();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleResolverDictamen = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/garantias/reclamo/${reclamoEditando.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solucionDetalle: dictamenData.solucionDetalle,
          estado: dictamenData.procedeGarantia ? "RESUELTO" : "RECHAZADO",
        }),
      });

      if (res.ok) {
        setMsgExito("✅ Dictamen técnico registrado y ticket de garantía actualizado.");
        setModalDictamen(false);
        cargarGarantias();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const certificadosFiltrados = certificados.filter(
    (c) =>
      c.codigoCertificado?.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.trabajo?.codigoCorrelativo?.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.trabajo?.cliente?.nombreCompleto?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface p-5 rounded-2xl border border-line shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-ink tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
            Portal de Garantías & Post-Venta
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Certificados QR oficiales emitidos, control de vigencias de 12 meses y atención de reclamos técnicos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {certificados.length > 0 && (
            <button
              onClick={() => setModalNuevoReclamo(true)}
              className="px-4 py-2 bg-[#F06529] hover:bg-[#D94E15] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Ingresar Reclamo</span>
            </button>
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
      <div className="flex items-center gap-2 border-b border-line pb-2">
        <button
          onClick={() => setTabActiva("certificados")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            tabActiva === "certificados"
              ? "bg-[#0F2C59] text-white shadow-sm"
              : "bg-surface text-secondary hover:bg-wash border border-line"
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Certificados Emitidos ({certificados.length})</span>
        </button>

        <button
          onClick={() => setTabActiva("reclamos")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            tabActiva === "reclamos"
              ? "bg-[#0F2C59] text-white shadow-sm"
              : "bg-surface text-secondary hover:bg-wash border border-line"
          }`}
        >
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span>Tickets de Reclamo ({reclamos.length})</span>
        </button>
      </div>

      {/* TAB 1: CERTIFICADOS EMITIDOS */}
      {tabActiva === "certificados" && (
        <div className="space-y-4">
          <div className="bg-surface p-4 rounded-2xl border border-line shadow-xs flex items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="h-4 w-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por código, orden o cliente..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-canvas border border-line rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#F06529]"
              />
            </div>
            <span className="text-xs text-faint font-semibold hidden sm:inline">
              Vigencia de los certificados de garantía
            </span>
          </div>

          <div className="bg-surface rounded-2xl border border-line shadow-xs overflow-hidden">
            {certificadosFiltrados.length === 0 ? (
              <div className="p-12 text-center">
                <ShieldCheck className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-secondary">No hay certificados generados aún</h4>
                <p className="text-xs text-faint mt-1">
                  Los certificados se generan automáticamente al realizar el Cierre Financiero de cada trabajo.
                </p>
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-canvas border-b border-line text-faint font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Código Certificado & Trabajo</th>
                    <th className="py-3 px-4">Cliente & Dirección</th>
                    <th className="py-3 px-4 text-center">Período de Cobertura</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-ink">
                  {certificadosFiltrados.map((c) => {
                    const ahora = new Date();
                    const esVigente = ahora <= new Date(c.fechaFin);
                    return (
                      <tr key={c.id} className="hover:bg-canvas/80">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-700 dark:text-emerald-300">
                              <QrCode className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-mono font-black text-ink">{c.codigoCertificado}</p>
                              <span className="text-[10px] text-faint">
                                Orden: {c.trabajo?.codigoCorrelativo} ({c.trabajo?.subtipoNombre})
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-ink">{c.trabajo?.cliente?.nombreCompleto}</p>
                          <span className="text-[11px] text-muted">{c.trabajo?.cliente?.direccion}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-semibold text-secondary block">
                            {new Date(c.fechaInicio).toLocaleDateString("es-CL")} al {new Date(c.fechaFin).toLocaleDateString("es-CL")}
                          </span>
                          <span className="text-[10px] text-faint">({c.mesesCobertura} Meses)</span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                              esVigente
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900"
                                : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900"
                            }`}
                          >
                            {esVigente ? "VIGENTE" : "VENCIDA"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => {
                              setCertSeleccionado(c);
                              setModalCertificado(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#0F2C59] hover:bg-[#1A3E72] text-white text-[11px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                            title="Ver Certificado Imprimible"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            <span>Imprimir</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TICKETS DE RECLAMO */}
      {tabActiva === "reclamos" && (
        <div className="bg-surface rounded-2xl border border-line shadow-xs overflow-hidden">
          {reclamos.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-secondary">Sin reclamos activos</h4>
              <p className="text-xs text-faint mt-1">
                Todas las instalaciones y servicios ejecutados operan de manera óptima y conforme.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {reclamos.map((r) => (
                <div key={r.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-canvas">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-ink">
                        Reclamo #{r.id.slice(0, 8)}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          r.estado === "PENDIENTE"
                            ? "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
                            : r.estado === "RESUELTO"
                            ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
                            : "bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300"
                        }`}
                      >
                        {r.estado}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-ink">
                      Cliente: {r.trabajoOriginal?.cliente?.nombreCompleto} • {r.trabajoOriginal?.cliente?.direccion}
                    </p>

                    <p className="text-xs text-secondary">
                      <strong>Falla Reportada:</strong> {r.descripcionFalla}
                    </p>

                    {r.solucionDetalle && (
                      <p className="text-[11px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 p-2 rounded-lg mt-1">
                        <strong>Resolución:</strong> {r.solucionDetalle}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {r.estado === "PENDIENTE" && (
                      <button
                        onClick={() => {
                          setReclamoEditando(r);
                          setModalDictamen(true);
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
                      >
                        <Wrench className="h-3.5 w-3.5" />
                        <span>Evaluar Dictamen</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL CERTIFICADO IMPRIMIBLE CON QR (SERVIGAZ BOLIVIA) */}
      {modalCertificado && certSeleccionado && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-2xl max-w-lg w-full shadow-2xl border border-line-soft overflow-hidden">
            <div className="bg-gradient-to-r from-[#0F2C59] to-[#1A3E72] text-white p-6 text-center space-y-2">
              <ShieldCheck className="h-10 w-10 text-emerald-400 mx-auto" />
              <h3 className="text-lg font-black tracking-tight">CERTIFICADO OFICIAL DE GARANTÍA</h3>
              <p className="text-xs text-slate-300">SERVIGAZ • Equipos e Instalaciones Térmicas</p>
            </div>

            <div className="p-6 space-y-4 text-xs text-ink text-center">
              <div className="p-4 bg-canvas border rounded-2xl space-y-1">
                <p className="font-mono text-base font-black text-ink">{certSeleccionado.codigoCertificado}</p>
                <p className="text-secondary font-medium">Orden de Trabajo: {certSeleccionado.trabajo?.codigoCorrelativo}</p>
              </div>

              <div className="text-left space-y-2 p-4 bg-emerald-50/50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 rounded-xl text-xs">
                <p><strong>Cliente:</strong> {certSeleccionado.trabajo?.cliente?.nombreCompleto}</p>
                <p><strong>Dirección:</strong> {certSeleccionado.trabajo?.cliente?.direccion}</p>
                <p><strong>Servicio Realizado:</strong> {certSeleccionado.trabajo?.subtipoNombre}</p>
                <p><strong>Período de Cobertura:</strong> {certSeleccionado.mesesCobertura} Meses ({new Date(certSeleccionado.fechaInicio).toLocaleDateString("es-CL")} al {new Date(certSeleccionado.fechaFin).toLocaleDateString("es-CL")})</p>
              </div>

              <div className="p-3 bg-canvas rounded-xl text-center space-y-1">
                <p className="font-mono text-[10px] text-muted break-all">{certSeleccionado.qrCodeData}</p>
                <p className="text-[10px] text-faint">Escanee el código QR para validar la autenticidad del certificado</p>
              </div>
            </div>

            <div className="p-4 bg-wash border-t flex justify-between">
              <button onClick={() => setModalCertificado(false)} className="px-4 py-2 bg-surface border rounded-xl font-bold text-xs">Cerrar</button>
              <button onClick={() => window.print()} className="px-5 py-2 bg-[#0F2C59] text-white rounded-xl font-bold text-xs flex items-center gap-1.5">
                <Printer className="h-4 w-4" /> Imprimir Certificado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO RECLAMO */}
      {modalNuevoReclamo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-2xl p-6 max-w-md w-full shadow-2xl border border-line-soft space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-black text-ink flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-[#F06529]" /> Ingresar Reclamo de Post-Venta
              </h3>
              <button onClick={() => setModalNuevoReclamo(false)} className="text-faint hover:text-secondary"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleCrearReclamo} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-secondary mb-1">Garantía / Trabajo Asociado</label>
                <select
                  required
                  value={nuevoReclamoData.trabajoOriginalId}
                  onChange={(e) => setNuevoReclamoData({ ...nuevoReclamoData, trabajoOriginalId: e.target.value })}
                  className="w-full p-2.5 bg-canvas border rounded-xl font-bold outline-none"
                >
                  <option value="">Seleccionar trabajo garantizado...</option>
                  {certificados.map((c) => (
                    <option key={c.id} value={c.trabajoId}>
                      {c.codigoCertificado} — {c.trabajo?.cliente?.nombreCompleto} ({c.trabajo?.subtipoNombre})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-secondary mb-1">Descripción de la Falla Reportada</label>
                <textarea
                  rows={3}
                  required
                  value={nuevoReclamoData.descripcionFalla}
                  onChange={(e) => setNuevoReclamoData({ ...nuevoReclamoData, descripcionFalla: e.target.value })}
                  placeholder="Detalle la anomalía informada por el cliente..."
                  className="w-full p-2.5 bg-canvas border rounded-xl font-medium outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setModalNuevoReclamo(false)} className="px-4 py-2 border rounded-xl font-bold">Cancelar</button>
                <button type="submit" className="px-5 py-2 bg-[#F06529] hover:bg-[#D94E15] text-white rounded-xl font-bold">Abrir Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

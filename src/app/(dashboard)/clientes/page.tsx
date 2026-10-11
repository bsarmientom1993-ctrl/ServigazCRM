"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  PlusCircle,
  Search,
  MapPin,
  Phone,
  Mail,
  Award,
  Sparkles,
  CheckCircle,
} from "lucide-react";

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [modalNuevo, setModalNuevo] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({
    nombreCompleto: "",
    telefono: "",
    email: "",
    direccion: "",
    ubicacionMapsUrl: "",
  });

  const cargarClientes = () => {
    fetch("/api/clientes")
      .then((r) => r.json())
      .then((data) => setClientes(Array.isArray(data) ? data : []));
  };

  useEffect(() => {
    cargarClientes();
  }, []);

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nuevoCliente),
    });
    setModalNuevo(false);
    setNuevoCliente({ nombreCompleto: "", telefono: "", email: "", direccion: "", ubicacionMapsUrl: "" });
    cargarClientes();
  };

  const nivelBadge: any = {
    VIP: "bg-purple-100 text-purple-800 border-purple-200",
    FRECUENTE: "bg-orange-100 text-orange-800 border-orange-200",
    REGULAR: "bg-blue-100 text-blue-800 border-blue-200",
    NUEVO: "bg-slate-100 text-slate-700 border-slate-200",
  };

  const filtered = clientes.filter(
    (c) =>
      c.nombreCompleto.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.direccion.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-[#0F2C59] tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-[#F06529]" />
            Directorio de Clientes & Fidelización (Fase 2 & 17)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro con geolocalización, prevención de duplicados y niveles de descuento sugerido (VIP/Frecuente).
          </p>
        </div>

        <button
          onClick={() => setModalNuevo(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#F06529] hover:bg-[#D94E15] text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Registrar Nuevo Cliente</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre o dirección..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#F06529]"
          />
        </div>
      </div>

      {/* Grid of Clients */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <div
            key={c.id}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    nivelBadge[c.nivelFidelizacion] || "bg-slate-100 text-slate-700"
                  }`}
                >
                  {c.nivelFidelizacion}
                </span>

                {Number(c.descuentoVipPct) > 0 && (
                  <span className="text-[10px] font-bold text-[#F06529]">
                    -{c.descuentoVipPct}% Desc. Sugerido
                  </span>
                )}
              </div>

              <h4 className="text-sm font-bold text-slate-900">{c.nombreCompleto}</h4>

              <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                <p className="flex items-center gap-2 text-slate-500">
                  <MapPin className="h-3.5 w-3.5 text-[#0F2C59] shrink-0" />
                  <span className="truncate">{c.direccion}</span>
                </p>
                <p className="flex items-center gap-2 text-slate-500">
                  <Phone className="h-3.5 w-3.5 text-[#0F2C59] shrink-0" />
                  <span>{Array.isArray(c.telefonos) ? c.telefonos.join(", ") : c.telefonos}</span>
                </p>
                {c.email && (
                  <p className="flex items-center gap-2 text-slate-500">
                    <Mail className="h-3.5 w-3.5 text-[#0F2C59] shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#0F2C59]">
              <span>Trabajos Históricos:</span>
              <span className="font-black px-2 py-0.5 bg-slate-100 rounded-md">
                {c._count?.trabajos ?? 0}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Nuevo Cliente */}
      {modalNuevo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <h3 className="text-base font-black text-[#0F2C59]">Registrar Nuevo Cliente</h3>
            <form onSubmit={handleCrear} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nombre Completo</label>
                <input
                  required
                  value={nuevoCliente.nombreCompleto}
                  onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombreCompleto: e.target.value })}
                  placeholder="Ej: Inmobiliaria Los Andes"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Teléfono</label>
                <input
                  required
                  value={nuevoCliente.telefono}
                  onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })}
                  placeholder="+56 9 1234 5678"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Dirección</label>
                <input
                  required
                  value={nuevoCliente.direccion}
                  onChange={(e) => setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })}
                  placeholder="Av. El Golf 400, Las Condes"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalNuevo(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#F06529] text-white rounded-xl font-bold"
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

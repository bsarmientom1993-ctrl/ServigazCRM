"use client";

import Link from "next/link";
import {useAuth} from "@/context/AuthContext";
import {customerWorkLabels,customerSearchText} from '@/lib/customer-directory';
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
  const {user}=useAuth();
  const [clientes, setClientes] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [modalNuevo, setModalNuevo] = useState(false);
  const [error,setError]=useState(''),[loading,setLoading]=useState(true);
  const [nuevoCliente, setNuevoCliente] = useState({
    nombreCompleto: "",
    telefono: "",
    email: "",
    direccion: "",
    ubicacionMapsUrl: "",
  });

  const cargarClientes = () => {
    setLoading(true);
    fetch("/api/clientes?directorio=1")
      .then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo cargar el directorio.');return data;})
      .then((data) => {setClientes(Array.isArray(data) ? data : []);setError('');})
      .catch(e=>setError(e.message)).finally(()=>setLoading(false));
  };

  useEffect(() => {
    cargarClientes();
  }, []);

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    const response=await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nuevoCliente),
    });
    if(!response.ok){const data=await response.json().catch(()=>({}));setError(data.error||'No se pudo registrar al cliente.');return;}
    setModalNuevo(false);
    setNuevoCliente({ nombreCompleto: "", telefono: "", email: "", direccion: "", ubicacionMapsUrl: "" });
    cargarClientes();
  };

  const nivelBadge: any = {
    VIP: "bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-900",
    FRECUENTE: "bg-orange-100 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-900",
    REGULAR: "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-900",
    NUEVO: "bg-wash text-secondary border-line",
  };

  const filtered = clientes.filter(
    (c) =>
      customerSearchText(c.nombreCompleto+' '+(c.direccion||'')+' '+(c.telefonos||[]).join(' ')).includes(customerSearchText(busqueda))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-5 rounded-2xl border border-line shadow-xs">
        <div>
          <h2 className="text-xl font-black text-ink tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-[#F06529]" />
            Clientes y trabajos pendientes
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Una ficha por cliente. Consulta sus pendientes aquí y abre el historial cuando lo necesites.
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
      <div className="bg-surface p-4 rounded-2xl border border-line shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o dirección..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-canvas border border-line rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#F06529]"
          />
        </div>
      </div>
      {error&&<p role="alert" className="module-error">{error}</p>}
      {loading&&<p role="status" className="module-note">Cargando clientes…</p>}
      {!loading&&!filtered.length&&<p className="module-note">No hay clientes que coincidan con la búsqueda.</p>}

      {/* Grid of Clients */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <div
            key={c.id}
            className="bg-surface p-5 rounded-2xl border border-line shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    nivelBadge[c.nivelFidelizacion] || "bg-wash text-secondary"
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

              <h4 className="text-sm font-bold text-ink">{c.nombreCompleto}</h4>

              <div className="mt-3 space-y-1.5 text-xs text-secondary">
                <p className="flex items-center gap-2 text-muted">
                  <MapPin className="h-3.5 w-3.5 text-ink shrink-0" />
                  <span className="truncate">{c.direccion}</span>
                </p>
                <p className="flex items-center gap-2 text-muted">
                  <Phone className="h-3.5 w-3.5 text-ink shrink-0" />
                  <span>{Array.isArray(c.telefonos) ? c.telefonos.join(", ") : c.telefonos}</span>
                </p>
                {c.email && (
                  <p className="flex items-center gap-2 text-muted">
                    <Mail className="h-3.5 w-3.5 text-ink shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-line-soft space-y-3 text-sm">
              <p className="font-semibold">{c.pendientes?.length?c.pendientes.length+' '+(c.pendientes.length===1?'trabajo pendiente':'trabajos pendientes'):'Sin trabajos pendientes'}</p>
              {(c.pendientes||[]).slice(0,3).map((w:any)=><Link className="block rounded-xl border border-line p-3" key={w.id} href={user?.rol==='VENTAS'?'/recepcion/'+w.id:'/trabajos/'+w.id}><strong className="text-xs">{w.subtipoNombre}</strong><p className="text-xs text-muted mt-1">{w.codigoCorrelativo} · {customerWorkLabels[w.estado]||w.estado}</p></Link>)}
              {c.pendientes?.length>3&&<details><summary className="cursor-pointer text-sm">Ver los otros {c.pendientes.length-3} pendientes</summary><div className="space-y-2 mt-2">{c.pendientes.slice(3).map((w:any)=><Link key={w.id} className="block text-sm underline" href={user?.rol==='VENTAS'?'/recepcion/'+w.id:'/trabajos/'+w.id}>{w.codigoCorrelativo} · {w.subtipoNombre} · {customerWorkLabels[w.estado]||w.estado}</Link>)}</div></details>}
            </div>
            <div className="mt-4 space-y-3"><Link className="theme-toggle inline-flex" href={"/trabajos/nuevo?clienteId="+encodeURIComponent(c.id)}>Nueva solicitud</Link><CustomerHistory customerId={c.id} sales={user?.rol==='VENTAS'}/></div>
          </div>
        ))}
      </div>

      {/* Modal Nuevo Cliente */}
      {modalNuevo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-2xl p-6 max-w-md w-full shadow-2xl border border-line-soft space-y-4">
            <h3 className="text-base font-black text-ink">Registrar Nuevo Cliente</h3>
            {error&&<p role="alert" className="module-error">{error}</p>}
            <form onSubmit={handleCrear} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-secondary mb-1">Nombre Completo</label>
                <input
                  required
                  value={nuevoCliente.nombreCompleto}
                  onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombreCompleto: e.target.value })}
                  placeholder="Ej: Inmobiliaria Los Andes"
                  className="w-full p-2.5 bg-canvas border border-line rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-secondary mb-1">Teléfono</label>
                <input
                  required
                  value={nuevoCliente.telefono}
                  onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })}
                  placeholder="+56 9 1234 5678"
                  className="w-full p-2.5 bg-canvas border border-line rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-secondary mb-1">Dirección</label>
                <input
                  required
                  value={nuevoCliente.direccion}
                  onChange={(e) => setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })}
                  placeholder="Av. El Golf 400, Las Condes"
                  className="w-full p-2.5 bg-canvas border border-line rounded-xl outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalNuevo(false)}
                  className="px-4 py-2 border border-line rounded-xl font-bold text-secondary"
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
function CustomerHistory({customerId,sales}:{customerId:string;sales:boolean}){
 const [open,setOpen]=useState(false),[history,setHistory]=useState<any[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function show(){setOpen(!open);if(open||history||busy)return;setBusy(true);setError('');try{const r=await fetch('/api/clientes?directorio=1&historial='+encodeURIComponent(customerId));const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo consultar el historial.');setHistory(d.trabajos);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <div><button type="button" aria-expanded={open} className="text-sm underline text-secondary" onClick={()=>void show()}>{open?'Ocultar historial':'Ver historial completo'}</button>{open&&<div className="mt-3 space-y-2">{busy&&<p role="status" className="text-xs text-muted">Consultando historial…</p>}{error&&<p role="alert" className="module-error">{error}</p>}{history?.length===0&&<p className="text-xs text-muted">El cliente todavía no tiene trabajos registrados.</p>}{history?.map(w=><Link key={w.id} className="block rounded-lg border border-line p-2 text-xs" href={(sales?'/recepcion/':'/trabajos/')+w.id}><strong>{w.codigoCorrelativo} · {w.subtipoNombre}</strong><p className="text-muted mt-1">{customerWorkLabels[w.estado]||w.estado} · {new Date(w.createdAt).toLocaleDateString('es-BO',{timeZone:'America/La_Paz'})}</p></Link>)}</div>}</div>;
}

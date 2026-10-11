"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  PlusCircle,
  Search,
  Truck,
  AlertTriangle,
  ArrowDownUp,
  Tag,
  CheckCircle,
  Building,
  DollarSign,
} from "lucide-react";

export default function InventarioPage() {
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const cargarProductos = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventario");
      if (res.ok) {
        const data = await res.json();
        setProductos(data.productos || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarProductos();
  }, []);

  const filtered = productos.filter(
    (p) =>
      p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.codigoSku?.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.categoria?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-[#0F2C59] tracking-tight flex items-center gap-2">
            <Package className="h-5 w-5 text-[#F06529]" />
            Inventario & Stock de Materiales
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Control de existencias, costeo promedio ponderado y registro de compras a proveedores oficiales (#96).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/inventario/compras"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#F06529] hover:bg-[#D94E15] text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>+ Registrar Compra a Proveedor (#96)</span>
          </Link>
        </div>
      </div>

      {/* Search and stats */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por SKU, nombre o categoría..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#F06529]"
          />
        </div>

        <div className="hidden sm:flex items-center gap-4 text-xs font-semibold text-slate-600">
          <span className="flex items-center gap-1.5 text-emerald-600">
            <CheckCircle className="h-4 w-4" /> {productos.length} Productos Registrados
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <Truck className="h-4 w-4" /> Moneda Oficial: Bolivianos (Bs.)
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">SKU / Producto</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4 text-center">Stock Actual</th>
                <th className="py-3 px-4 text-right">Costo Promedio</th>
                <th className="py-3 px-4 text-right">Precio Venta</th>
                <th className="py-3 px-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    {loading ? "Cargando inventario..." : "No se encontraron productos en el inventario."}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const stockNum = Number(p.stockActual || 0);
                  const minNum = Number(p.stockMinimo || 5);
                  const esBajo = stockNum <= minNum;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-[#0F2C59]">{p.nombre}</p>
                        <span className="font-mono text-[10px] text-slate-400">{p.codigoSku}</span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-600">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {p.categoria}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`font-black px-2.5 py-1 rounded-full text-xs border ${
                            esBajo
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {stockNum} {p.unidadMedida || "un"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                        Bs. {Number(p.costoPromedio || 0).toLocaleString("es-CL")}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-slate-900">
                        Bs. {Number(p.precioVenta || 0).toLocaleString("es-CL")}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {esBajo ? (
                          <span className="text-[10px] font-bold text-red-600 bg-red-100/60 px-2 py-0.5 rounded-full">
                            ⚠️ Stock Crítico
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100/60 px-2 py-0.5 rounded-full">
                            ✅ Disponible
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

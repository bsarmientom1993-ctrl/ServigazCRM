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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-5 rounded-2xl border border-line shadow-xs">
        <div>
          <h2 className="text-xl font-black text-ink tracking-tight flex items-center gap-2">
            <Package className="h-5 w-5 text-[#F06529]" />
            Inventario & Stock de Materiales
          </h2>
          <p className="text-xs text-muted mt-0.5">
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
      <div className="bg-surface p-4 rounded-2xl border border-line shadow-xs flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por SKU, nombre o categoría..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-canvas border border-line rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#F06529]"
          />
        </div>

        <div className="hidden sm:flex items-center gap-4 text-xs font-semibold text-secondary">
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-300">
            <CheckCircle className="h-4 w-4" /> {productos.length} Productos Registrados
          </span>
          <span className="flex items-center gap-1.5 text-faint">
            <Truck className="h-4 w-4" /> Moneda Oficial: Bolivianos (Bs.)
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-line shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-canvas border-b border-line text-muted font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">SKU / Producto</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4 text-center">Stock Actual</th>
                <th className="py-3 px-4 text-right">Costo Promedio</th>
                <th className="py-3 px-4 text-right">Precio Venta</th>
                <th className="py-3 px-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-ink">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-faint">
                    {loading ? "Cargando inventario..." : "No se encontraron productos en el inventario."}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const stockNum = Number(p.stockActual || 0);
                  const minNum = Number(p.stockMinimo || 5);
                  const esBajo = stockNum <= minNum;

                  return (
                    <tr key={p.id} className="hover:bg-canvas/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-ink">{p.nombre}</p>
                        <span className="font-mono text-[10px] text-faint">{p.codigoSku}</span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-secondary">
                        <span className="px-2 py-0.5 rounded-md bg-wash text-secondary">
                          {p.categoria}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`font-black px-2.5 py-1 rounded-full text-xs border ${
                            esBajo
                              ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900"
                              : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900"
                          }`}
                        >
                          {stockNum} {p.unidadMedida || "un"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-secondary">
                        Bs. {Number(p.costoPromedio || 0).toLocaleString("es-CL")}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-ink">
                        Bs. {Number(p.precioVenta || 0).toLocaleString("es-CL")}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {esBajo ? (
                          <span className="text-[10px] font-bold text-red-600 dark:text-red-300 bg-red-100/60 dark:bg-red-950/40 px-2 py-0.5 rounded-full">
                            ⚠️ Stock Crítico
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
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

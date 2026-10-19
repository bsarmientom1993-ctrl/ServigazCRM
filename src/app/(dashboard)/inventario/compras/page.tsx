"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  PlusCircle,
  Truck,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  History,
  TrendingUp,
  FileText,
  DollarSign,
  Building,
  Sparkles,
  Calculator,
} from "lucide-react";

export default function ComprasProveedoresPage() {
  const [productos, setProductos] = useState<any[]>([]);
  const [compras, setCompras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [formCompra, setFormCompra] = useState({
    productoId: "",
    cantidad: "",
    precioCompraUnitario: "",
    proveedorNombre: "",
    proveedorContacto: "",
    numeroDocumento: "",
    observaciones: "",
    registrarEgresoCaja: true,
  });

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [resProd, resComp] = await Promise.all([
        fetch("/api/inventario"),
        fetch("/api/inventario/compras"),
      ]);

      if (resProd.ok) {
        const dataP = await resProd.json();
        setProductos(dataP.productos || []);
      }

      if (resComp.ok) {
        const dataC = await resComp.json();
        setCompras(dataC.compras || []);
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

  // Producto seleccionado y cálculo de costo promedio ponderado en vivo
  const productoSeleccionado = productos.find((p) => p.id === formCompra.productoId);
  const stockAnterior = Number(productoSeleccionado?.stockActual || 0);
  const costoAnterior = Number(productoSeleccionado?.costoPromedio || 0);
  const cantComprada = Number(formCompra.cantidad || 0);
  const precioUnitario = Number(formCompra.precioCompraUnitario || 0);

  const stockNuevo = stockAnterior + cantComprada;
  const totalCompra = cantComprada * precioUnitario;

  let nuevoCostoPromedioCalculado = precioUnitario;
  if (stockAnterior > 0 && stockNuevo > 0) {
    nuevoCostoPromedioCalculado = Number(
      (((stockAnterior * costoAnterior) + (cantComprada * precioUnitario)) / stockNuevo).toFixed(2)
    );
  }

  const handleRegistrarCompra = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setSaving(true);

    try {
      const res = await fetch("/api/inventario/compras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formCompra),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Error al registrar la compra");
        return;
      }

      setSuccessMsg(
        `Compra registrada: Stock actualizado a ${data.resumen.stockNuevo} y Costo Promedio ajustado a Bs. ${data.resumen.nuevoCostoPromedio}`
      );

      setFormCompra({
        productoId: "",
        cantidad: "",
        precioCompraUnitario: "",
        proveedorNombre: "",
        proveedorContacto: "",
        numeroDocumento: "",
        observaciones: "",
        registrarEgresoCaja: true,
      });

      cargarDatos();
    } catch (err: any) {
      setErrorMsg("Error de conexión: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-5 rounded-2xl border border-line shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/inventario"
            className="p-2 rounded-xl bg-wash hover:bg-emphasis text-secondary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-ink tracking-tight">
                Compras a Proveedores Oficiales
              </h1>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                Fase 20 • Regla #96
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Registro formal de facturas de insumos con actualización automática de costo promedio ponderado.
            </p>
          </div>
        </div>

        <Link
          href="/finanzas"
          className="px-4 py-2 bg-wash hover:bg-emphasis text-secondary rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
          <span>Ver Balance en Finanzas</span>
        </Link>
      </div>

      {/* Alertas */}
      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid Principal: Formulario a la izquierda, Simulación e Historial */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Formulario de Compra (7 columnas) */}
        <div className="lg:col-span-7 bg-surface p-6 rounded-2xl border border-line shadow-xs space-y-5">
          <div className="border-b border-line-soft pb-3">
            <h3 className="text-sm font-black text-ink uppercase tracking-wider flex items-center gap-2">
              <PlusCircle className="h-4 w-4 text-[#F06529]" /> Registrar Nueva Factura / Nota de Compra
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Ingresa los datos del proveedor y los insumos adquiridos para el taller o tienda.
            </p>
          </div>

          <form onSubmit={handleRegistrarCompra} className="space-y-4 text-xs">
            {/* 1. Selección de Producto */}
            <div>
              <label className="block font-bold text-secondary mb-1">
                Producto / Material de Almacén <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formCompra.productoId}
                onChange={(e) => setFormCompra({ ...formCompra, productoId: e.target.value })}
                className="w-full p-3 bg-canvas border border-line-strong rounded-xl font-bold text-ink outline-none focus:ring-2 focus:ring-[#F06529]"
              >
                <option value="">-- Elige un producto a reabastecer --</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} (SKU: {p.codigoSku}) — Stock actual: {p.stockActual} {p.unidadMedida}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Cantidad y Precio de Compra */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-secondary mb-1">
                  Cantidad Comprada ({productoSeleccionado?.unidadMedida || "unidades"}) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0.1"
                  step="any"
                  value={formCompra.cantidad}
                  onChange={(e) => setFormCompra({ ...formCompra, cantidad: e.target.value })}
                  placeholder="Ej: 50"
                  className="w-full p-2.5 bg-canvas border border-line rounded-xl font-bold text-ink outline-none focus:ring-2 focus:ring-[#F06529]"
                />
              </div>

              <div>
                <label className="block font-bold text-secondary mb-1">
                  Precio Unitario de Compra (Bs.) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  value={formCompra.precioCompraUnitario}
                  onChange={(e) => setFormCompra({ ...formCompra, precioCompraUnitario: e.target.value })}
                  placeholder="Ej: 45.50"
                  className="w-full p-2.5 bg-canvas border border-line rounded-xl font-bold text-ink outline-none focus:ring-2 focus:ring-[#F06529]"
                />
              </div>
            </div>

            {/* 3. Datos del Proveedor Oficial (#96) */}
            <div className="p-4 rounded-xl bg-canvas border border-line space-y-3">
              <span className="font-black text-ink block text-xs flex items-center gap-1.5">
                <Building className="h-4 w-4 text-[#F06529]" /> Datos del Proveedor Oficial (Regla #96)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-secondary mb-1">
                    Razón Social / Empresa <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formCompra.proveedorNombre}
                    onChange={(e) => setFormCompra({ ...formCompra, proveedorNombre: e.target.value })}
                    placeholder="Ej: Tigre Plasmar / Importadora GasBol"
                    className="w-full p-2.5 bg-surface border border-line-strong rounded-xl font-bold text-ink outline-none focus:ring-2 focus:ring-[#F06529]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-secondary mb-1">
                    NIT / Teléfono de Contacto
                  </label>
                  <input
                    type="text"
                    value={formCompra.proveedorContacto}
                    onChange={(e) => setFormCompra({ ...formCompra, proveedorContacto: e.target.value })}
                    placeholder="Ej: NIT: 1029384 • Tel: 2-2789123"
                    className="w-full p-2.5 bg-surface border border-line-strong rounded-xl font-medium outline-none focus:ring-2 focus:ring-[#F06529]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-secondary mb-1">
                  N° de Factura / Nota de Entrega
                </label>
                <input
                  type="text"
                  value={formCompra.numeroDocumento}
                  onChange={(e) => setFormCompra({ ...formCompra, numeroDocumento: e.target.value })}
                  placeholder="Ej: FAC-0012948 / Nota #45"
                  className="w-full p-2.5 bg-surface border border-line-strong rounded-xl font-medium outline-none focus:ring-2 focus:ring-[#F06529]"
                />
              </div>
            </div>

            {/* Switch de Egreso en Caja */}
            <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-center justify-between">
              <div>
                <strong className="text-amber-950 dark:text-amber-300 font-bold block text-xs">
                  ¿Registrar egreso automático en Finanzas?
                </strong>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  Crea automáticamente un registro de gasto en la categoría "Compras de Inventario".
                </p>
              </div>
              <input
                type="checkbox"
                checked={formCompra.registrarEgresoCaja}
                onChange={(e) => setFormCompra({ ...formCompra, registrarEgresoCaja: e.target.checked })}
                className="w-5 h-5 accent-[#F06529] rounded cursor-pointer"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-[#F06529] hover:bg-[#D94E15] text-white rounded-xl font-black text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{saving ? "Procesando compra..." : "Confirmar Compra y Actualizar Costo"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Panel de Simulación y Resumen (5 columnas) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Tarjeta de Recálculo de Costo Ponderado en Vivo */}
          <div className="bg-gradient-to-br from-slate-900 to-[#0F2C59] text-white p-5 rounded-2xl shadow-md border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF7B42] flex items-center gap-1.5">
                <Calculator className="h-4 w-4" /> Costeo Promedio Ponderado
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10">En Vivo</span>
            </div>

            {productoSeleccionado ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-faint block text-[10px]">Producto a Actualizar:</span>
                  <p className="font-black text-white text-sm">{productoSeleccionado.nombre}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div>
                    <span className="text-faint text-[10px] block">Stock Anterior:</span>
                    <strong className="text-slate-200">
                      {stockAnterior} {productoSeleccionado.unidadMedida}
                    </strong>
                  </div>
                  <div>
                    <span className="text-faint text-[10px] block">Costo Anterior:</span>
                    <strong className="text-slate-200">Bs. {costoAnterior.toLocaleString("es-CL")}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div>
                    <span className="text-faint text-[10px] block">Comprando Ahora:</span>
                    <strong className="text-emerald-400">
                      +{cantComprada} {productoSeleccionado.unidadMedida}
                    </strong>
                  </div>
                  <div>
                    <span className="text-faint text-[10px] block">Inversión Total:</span>
                    <strong className="text-emerald-400">Bs. {totalCompra.toLocaleString("es-CL")}</strong>
                  </div>
                </div>

                {/* Nuevo Costo y Nuevo Stock */}
                <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-400/30 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-300 font-bold text-[11px]">Nuevo Stock Total:</span>
                    <strong className="text-white font-black text-sm">
                      {stockNuevo} {productoSeleccionado.unidadMedida}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-300 font-bold text-[11px]">Nuevo Costo Promedio:</span>
                    <strong className="text-[#FF7B42] font-black text-base">
                      Bs. {nuevoCostoPromedioCalculado.toLocaleString("es-CL")}
                    </strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-faint text-xs">
                Selecciona un producto del formulario para simular el impacto en el costo promedio de almacén.
              </div>
            )}
          </div>

          {/* Información Normativa */}
          <div className="bg-surface p-4 rounded-2xl border border-line shadow-xs text-xs text-secondary space-y-2">
            <h4 className="font-bold text-ink flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-[#F06529]" /> ¿Cómo funciona el Costo Ponderado?
            </h4>
            <p className="text-[11px] text-muted">
              Al ingresar una compra a un precio diferente al anterior, el sistema calcula la media ponderada exacta. Esto garantiza que las cotizaciones y los costos de materiales utilicen siempre el valor real de tu inventario.
            </p>
          </div>
        </div>
      </div>

      {/* Historial de Compras Recientes (#96) */}
      <div className="bg-surface p-5 rounded-2xl border border-line shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-line-soft pb-3">
          <h3 className="text-sm font-black text-ink uppercase tracking-wider flex items-center gap-2">
            <History className="h-4 w-4 text-[#F06529]" /> Historial de Compras a Proveedores Oficiales
          </h3>
          <span className="text-xs text-faint">Total: {compras.length} compras registradas</span>
        </div>

        <div className="border border-line rounded-xl overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead className="bg-canvas border-b border-line text-faint font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Proveedor Oficial (#96)</th>
                <th className="py-3 px-4">Material / Insumo</th>
                <th className="py-3 px-4 text-center">Cantidad</th>
                <th className="py-3 px-4">Documento / Observaciones</th>
                <th className="py-3 px-4">Registrado Por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-ink">
              {compras.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-faint">
                    No se han registrado compras todavía. Usa el formulario de arriba para ingresar una.
                  </td>
                </tr>
              ) : (
                compras.map((c) => (
                  <tr key={c.id} className="hover:bg-canvas/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-secondary">
                      {new Date(c.fecha).toLocaleDateString("es-CL")}
                    </td>
                    <td className="py-3 px-4">
                      <strong className="text-ink block">{c.proveedorNombre}</strong>
                      {c.proveedorContacto && (
                        <span className="text-[10px] text-faint">{c.proveedorContacto}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-ink">{c.producto?.nombre}</span>
                      <span className="text-[10px] text-faint block">SKU: {c.producto?.codigoSku}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-black text-xs">
                        +{Number(c.cantidad)} {c.producto?.unidadMedida}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-secondary">
                      {c.observaciones || "Compra directa"}
                    </td>
                    <td className="py-3 px-4 text-muted">
                      {c.usuario?.nombre || "Encargado"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

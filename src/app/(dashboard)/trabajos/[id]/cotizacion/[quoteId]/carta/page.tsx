"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { objectRecord } from "@/lib/gas-data";

const money = (value: unknown) => Number(value || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export default function CartaPage({ params }: { params: Promise<{ id: string; quoteId: string }> }) {
  const { id, quoteId } = use(params);
  const [work, setWork] = useState<any>(null), [error, setError] = useState("");
  useEffect(() => { const controller = new AbortController(); fetch("/api/trabajos/" + id, { signal: controller.signal }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "No se pudo cargar la cotización."); setWork(data); }).catch(err => { if (err.name !== "AbortError") setError(err.message); }); return () => controller.abort(); }, [id]);
  if (error) return <p role="alert" className="module-error">{error}</p>;
  if (!work) return <p className="module-note">Cargando carta de cotización…</p>;
  const quote = work.cotizaciones?.find((item: any) => item.id === quoteId);
  if (!quote) return <p role="alert" className="module-error">La cotización no está disponible.</p>;
  const letter = objectRecord(objectRecord(quote.datosFormularioJson).carta), gas = objectRecord(objectRecord(quote.snapshotCalculoJson).gas);
  const review = objectRecord(gas.supervision), rates = objectRecord(gas.tarifas);
  const rows: [string, unknown][] = [["Materiales", quote.subtotalMateriales], ["Mano de obra", gas.manoObraLineal ?? quote.subtotalManoObra], ...(Number(gas.importeProyecto) > 0 ? [["Proyecto de gas", gas.importeProyecto] as [string, unknown]] : []), ["Transporte", quote.montoTransporte]];
  return <div className="space-y-5">
    <div className="letter-toolbar flex flex-wrap gap-3"><Link href={"/trabajos/" + id} className="theme-toggle">Volver al trabajo</Link><button className="primary-action" onClick={() => window.print()}>Imprimir / Guardar PDF</button><p className="text-xs text-muted self-center">Selecciona «Guardar como PDF» en el diálogo de impresión.</p></div>
    <article className="quote-letter">
      <header className="letter-heading"><div><p className="letter-brand">SERVIGAZ</p><p>Equipos e Instalaciones</p>{letter.sucursal && <p>{letter.sucursal}</p>}</div><div><h1>COTIZACIÓN</h1><p>{work.codigoCorrelativo} · Versión {quote.numeroVersion}</p><p>Emitida: {new Date(quote.createdAt).toLocaleDateString("es")}</p><p>Válida hasta: <strong>{new Date(quote.fechaVencimiento).toLocaleDateString("es")}</strong></p><p>Estado: {quote.estado}</p></div></header>
      <section><p>Señor/a <strong>{letter.clienteNombre || work.cliente?.nombreCompleto}</strong></p>{letter.clienteDireccion && <p>{letter.clienteDireccion}</p>}<p className="mt-4">De nuestra consideración:</p><p>Presentamos nuestra propuesta para <strong>{letter.servicio || work.subtipoNombre}</strong>, con el siguiente alcance e importes expresados en bolivianos (Bs.).</p></section>
      <section><h2>Detalle del trabajo</h2><p className="whitespace-pre-wrap">{letter.alcance || work.subtipoNombre}</p></section>
      {gas.metrosTotales && <section><h2>Medición y criterio aprobado</h2><p>{review.metrosVisto} m vistos + {review.metrosEmpotrado} m empotrados = <strong>{gas.metrosTotales} m lineales</strong>.</p><table><thead><tr><th>Tarifa por metro</th><th>Visto</th><th>Empotrado</th></tr></thead><tbody><tr><td>Materiales (Bs./m)</td><td>{money(rates.materialVisto)}</td><td>{money(rates.materialEmpotrado)}</td></tr><tr><td>Mano de obra (Bs./m)</td><td>{money(rates.manoObraVisto)}</td><td>{money(rates.manoObraEmpotrado)}</td></tr></tbody></table><p>Factor de mano de obra: {rates.factorManoObra}. Promedio de instalación: Bs. {money(gas.promedioPorMetro)}/m, sin proyecto ni transporte.</p><p className="whitespace-pre-wrap">{review.criterio}</p><p>Visto bueno: {review.supervisorNombre} · {new Date(review.fecha).toLocaleDateString("es")}. {review.incluyeProyecto ? "Incluye seguimiento y entrega del proyecto de gas." : "No incluye proyecto de gas."}</p></section>}
      <section><h2>Presupuesto</h2><table><thead><tr><th>Concepto</th><th>Importe (Bs.)</th></tr></thead><tbody>{rows.map(([label, value]) => <tr key={label}><td>{label}</td><td>{money(value)}</td></tr>)}{Number(quote.montoDescuento) > 0 && <tr><td>Descuento ({Number(quote.porcentajeDescuento)} %)</td><td>− {money(quote.montoDescuento)}</td></tr>}<tr className="letter-total"><td>Total cotizado</td><td>{money(quote.totalCotizado)}</td></tr></tbody></table><p>Anticipo mínimo requerido: <strong>Bs. {money(quote.anticipoMinimoRequerido)}</strong>.</p></section>
      {letter.condiciones && <section><h2>Condiciones y exclusiones</h2><p className="whitespace-pre-wrap">{letter.condiciones}</p></section>}
      <footer><p>Esta propuesta es válida hasta el {new Date(quote.fechaVencimiento).toLocaleDateString("es")}. Los cambios de alcance requieren una nueva cotización.</p><p className="mt-5">Atentamente,<br /><strong>{letter.emisor || "SERVIGAZ · Equipos e Instalaciones"}</strong></p></footer>
    </article>
  </div>;
}

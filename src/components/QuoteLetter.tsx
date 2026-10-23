import type { CSSProperties } from 'react';
import { resolveQuoteTemplate } from '@/lib/quote-template';
import { objectRecord } from '@/lib/gas-data';
import { quoteDocumentRows, quoteDate, quoteMoney } from '@/lib/quote-document';

export function QuoteLetter({ work, quote }: { work: any; quote: any }) {
  const letter = objectRecord(objectRecord(quote.datosFormularioJson).carta);
  const format = resolveQuoteTemplate(letter.formato);
  const style = { '--quote-ink': format.colorTexto, '--quote-band': format.colorSecciones, '--quote-font': format.fuente + 'px', '--quote-print-font': (format.fuente * .75) + 'pt' } as CSSProperties;
  const gas = objectRecord(objectRecord(quote.snapshotCalculoJson).gas);
  const review = objectRecord(gas.supervision);
  const name = letter.cotizadoPorNombre || quote.emitidoPorNombre || '';
  return <article className="quote-letter" style={style} data-paper={format.papel} aria-label="Carta de cotización">
    <style>{`@media print { @page { size: ${format.papel}; margin: 10mm; } }`}</style>
    <header className="quote-stationery-header"><>{format.encabezadoImagen ? <img src={format.encabezadoImagen} alt={format.empresa} width="2100" height="250"/> : <p className="quote-company">{format.empresa}</p>}</><h1>{format.titulo}</h1><p className="quote-reference">{work.codigoCorrelativo} · Versión {quote.numeroVersion} · {quote.estado}</p></header>
    <dl className="quote-facts"><dt>FECHA :</dt><dd>{quoteDate(quote.createdAt)}</dd><dt>ASUNTO :</dt><dd>{letter.asunto || 'Propuesta de servicios y equipos'}</dd><dt>PROYECTO :</dt><dd>{letter.proyecto || letter.servicio || work.subtipoNombre}</dd><dt>CLIENTE :</dt><dd>{letter.clienteNombre || work.cliente?.nombreCompleto}</dd></dl>
    {(letter.clienteDireccion || work.cliente?.direccion) && <p className="quote-customer-address">{letter.clienteDireccion || work.cliente?.direccion}</p>}
    <section className="quote-scope"><h2>{format.tituloAlcance}</h2><p className="quote-intro">{format.introduccion}</p><p className="quote-preserve">{letter.alcance || work.subtipoNombre}</p></section>
    <section className="quote-budget"><h2>{format.tituloPresupuesto}</h2><table><colgroup><col style={{width:'6%'}}/><col style={{width:'40%'}}/><col style={{width:'10%'}}/><col style={{width:'22%'}}/><col style={{width:'22%'}}/></colgroup><thead><tr><th>N°</th><th>Concepto / Detalle del trabajo</th><th>Cantidad</th><th>Costo unitario (Bs.)</th><th>Importe total (Bs.)</th></tr></thead><tbody>{quoteDocumentRows(quote).map((row,index)=><tr key={row.concept}><td>{index+1}</td><td>{row.concept}</td><td>{row.quantity}</td><td>{quoteMoney(row.amount)}</td><td>{quoteMoney(row.amount)}</td></tr>)}</tbody><tfoot>{Number(quote.montoDescuento)>0 && <tr><td colSpan={4}>Descuento ({Number(quote.porcentajeDescuento)} %)</td><td>- {quoteMoney(quote.montoDescuento)}</td></tr>}<tr className="quote-total"><td colSpan={4}>TOTAL COTIZADO (Bs.)</td><td>{quoteMoney(quote.totalCotizado)}</td></tr></tfoot></table><p className="quote-payment">Anticipo mínimo requerido: <strong>Bs. {quoteMoney(quote.anticipoMinimoRequerido)}</strong>.</p></section>
    {gas.metrosTotales && <section className="quote-measurements"><h3>Medición y criterio aprobado</h3><p>{gas.metrosVisto ?? review.metrosVisto} m vistos + {gas.metrosEmpotrado ?? review.metrosEmpotrado} m empotrados = <strong>{gas.metrosTotales} m lineales</strong>. Promedio de instalación: <strong>Bs. {quoteMoney(gas.promedioPorMetro)}/m</strong>, sin proyecto ni transporte.</p>{review.criterio && <p className="quote-preserve">{review.criterio}</p>}{review.supervisorNombre && <p>Visto bueno: {review.supervisorNombre}{review.fecha ? ' · '+quoteDate(review.fecha) : ''}.</p>}</section>}
    <section className="quote-conditions"><p><strong>Validez:</strong> hasta el {quoteDate(quote.fechaVencimiento)}. Los cambios de alcance requieren una nueva cotización.</p>{letter.condiciones && <p className="quote-preserve"><strong>Condiciones: </strong>{letter.condiciones}</p>}{letter.nota && <p className="quote-preserve"><strong>Nota: </strong>{letter.nota}</p>}{Number(gas.importeProyecto)>0 && !letter.nota && <p><strong>Nota: </strong>Los plazos de revisión y aprobación del proyecto dependen de la entidad competente y de sus observaciones.</p>}</section>
    <div className="quote-signature"><p>{format.despedida}</p><p><strong>{name || 'Emisor no registrado'}</strong></p><p>{format.empresa}</p></div>
    <footer className="quote-stationery-footer">{format.pieImagen ? <img src={format.pieImagen} alt={format.pieTexto} width="2448" height="388"/> : <p className="quote-preserve quote-footer-text">{format.pieTexto}</p>}</footer>
  </article>;
}

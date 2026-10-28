import { objectRecord } from './gas-data';
export const quoteMoney = (value: unknown) => Number(value || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function quoteDate(value: string | Date) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('es-BO', { timeZone: 'America/La_Paz', day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
}
export function quoteDocumentRows(quote: any) {
  const independent = objectRecord(objectRecord(quote.datosFormularioJson).carta).modalidad === 'PROYECTO_INDEPENDIENTE';
  const gas = objectRecord(objectRecord(quote.snapshotCalculoJson).gas);
  return [
    { concept: 'Materiales y equipos', quantity: 1, amount: quote.subtotalMateriales },
    { concept: (independent ? 'Honorarios del proyecto' : 'Mano de obra') + (gas.metrosTotales ? ` (${gas.metrosTotales} m lineales)` : ''), quantity: 1, amount: gas.manoObraLineal ?? quote.subtotalManoObra },
    ...(Number(gas.importeProyecto) > 0 ? [{ concept: 'Elaboración, gestión y seguimiento del proyecto de gas', quantity: 1, amount: gas.importeProyecto }] : []),
    { concept: 'Transporte', quantity: 1, amount: quote.montoTransporte },
  ].filter(row => Number(row.amount) > 0);
}

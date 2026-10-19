import { ApiError } from "./api";

export function cents(value: unknown): number {
  const text = String(value);
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(text)) throw new ApiError(400, "Ingresa un importe válido, no negativo y con hasta dos decimales.");
  const [whole, fraction = ""] = text.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function money(value: number) { return (value / 100).toFixed(2); }
export const paymentStates = ["COTIZADO", "APROBADO", "PAGO_A_CUENTA_RECIBIDO", "ANTICIPO_RECIBIDO", "EN_PROCESO", "EN_PAUSA", "TERMINADO_TECNICO", "VALIDADO"];
export const preparatoryStates = ["APROBADO", "PAGO_A_CUENTA_RECIBIDO", "ANTICIPO_RECIBIDO"];

export function paymentResult(state: string, total: number, minimum: number, paid: number, amount: number) {
  if (!paymentStates.includes(state)) throw new ApiError(409, "La orden no admite cobros en su estado actual.");
  if (total <= 0 || minimum > total) throw new ApiError(409, "Revisa el total y anticipo de la cotización.");
  if (amount <= 0) throw new ApiError(400, "El pago debe ser mayor a cero.");
  if (paid >= total) throw new ApiError(409, "La orden ya está pagada.");
  if (amount > total - paid) throw new ApiError(400, "El pago supera el saldo pendiente.");
  const accumulated = paid + amount;
  const type: "ANTICIPO" | "PAGO_A_CUENTA" | "SALDO_FINAL" | "PAGO_TOTAL" = accumulated === total ? (paid === 0 ? "PAGO_TOTAL" : "SALDO_FINAL") :
    accumulated >= minimum ? "ANTICIPO" : "PAGO_A_CUENTA";
  // A payment never replaces the customer's acceptance.
  const nextState = preparatoryStates.includes(state) ?
    (accumulated >= minimum ? "ANTICIPO_RECIBIDO" : "PAGO_A_CUENTA_RECIBIDO") : state;
  return { type, nextState, accumulated, remaining: total - accumulated };
}

export function assertStart(state: string, assigned: boolean, approved: boolean, minimum: number, paid: number) {
  if (!preparatoryStates.includes(state)) throw new ApiError(409, "La orden debe estar aceptada antes de iniciar.");
  if (!approved) throw new ApiError(409, "Falta aceptar la versión vigente de la cotización.");
  if (!assigned) throw new ApiError(409, "Asigna un técnico antes de iniciar.");
  if (paid < minimum) throw new ApiError(409, "Falta completar el anticipo requerido.");
}
export function assertClose(state: string, total: number, paid: number) {
  if (state !== "VALIDADO") throw new ApiError(409, "Primero debe aprobarse la calidad del trabajo.");
  if (total <= 0 || paid !== total) throw new ApiError(409, "El cierre requiere saldo cero y pagos conciliados.");
}


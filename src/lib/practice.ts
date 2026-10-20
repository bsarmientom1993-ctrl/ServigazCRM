export type PracticeState = "BORRADOR" | "EVALUACION_PENDIENTE" | "EVALUADO" | "COTIZADO" | "APROBADO" | "ANTICIPO_RECIBIDO" | "EN_PROCESO" | "TERMINADO_TECNICO" | "VALIDADO" | "FINALIZADO_FINANCIERO";
export type PracticeEvent = "AGENDAR" | "EVALUAR" | "COTIZAR" | "ACEPTAR" | "ANTICIPO" | "INICIAR" | "MATERIALES" | "FINALIZAR" | "VALIDAR" | "SALDO" | "CERRAR";
export type ExampleId = "gas" | "plomeria" | "calefaccion" | "directo";
export type Example = { id: ExampleId; code: string; service: string; customer: string; description: string; total: number; minimum: number; materialCost: number; laborCost: number; transportCost: number; direct: boolean; initial: PracticeEvent[] };
export type PracticeJob = Example & { state: PracticeState; paid: number; technician: string | null; accepted: boolean; materialsRecorded: boolean; quality: boolean; closed: boolean };
export const examples: Example[] = [
  { id: "gas", code: "EJEMPLO-001", service: "Instalación de gas", customer: "Cliente ficticio 01", description: "Este caso comienza como una solicitud nueva. Practica coordinar la visita, evaluar y recorrer el trabajo hasta el cierre.", total: 240000, minimum: 120000, materialCost: 85000, laborCost: 70000, transportCost: 15000, direct: false, initial: [] },
  { id: "plomeria", code: "EJEMPLO-002", service: "Reparación de plomería", customer: "Cliente ficticio 02", description: "Este caso comienza con el presupuesto preparado. Practica la aceptación del cliente y el anticipo antes de empezar.", total: 65000, minimum: 32500, materialCost: 12000, laborCost: 22000, transportCost: 4000, direct: false, initial: ["AGENDAR", "EVALUAR", "COTIZAR"] },
  { id: "calefaccion", code: "EJEMPLO-003", service: "Mantenimiento de calefacción", customer: "Cliente ficticio 03", description: "Este caso comienza con un trabajo en ejecución. Practica registrar materiales, finalizar, validar calidad y cobrar el saldo.", total: 120000, minimum: 60000, materialCost: 22000, laborCost: 35000, transportCost: 5000, direct: false, initial: ["AGENDAR", "EVALUAR", "COTIZAR", "ACEPTAR", "ANTICIPO", "INICIAR"] },
  { id: "directo", code: "EJEMPLO-004", service: "Otro: revisión de equipo", customer: "Cliente ficticio 04", description: "Un servicio directo sin medición. Practica cotizar, cobrar el total y cerrar después de validar la calidad.", total: 18000, minimum: 18000, materialCost: 0, laborCost: 8000, transportCost: 2000, direct: true, initial: [] },
];
export function advancePractice(job: PracticeJob, event: PracticeEvent): PracticeJob {
  const next = { ...job };
  const requireState = (...states: PracticeState[]) => { if (!states.includes(job.state)) throw new Error("Completa primero el paso indicado para esta orden de ejemplo."); };
  switch (event) {
    case "AGENDAR": requireState("BORRADOR"); next.technician = "Técnico ficticio A"; next.state = "EVALUACION_PENDIENTE"; break;
    case "EVALUAR": requireState("EVALUACION_PENDIENTE"); next.state = "EVALUADO"; break;
    case "COTIZAR": requireState("EVALUADO"); next.state = "COTIZADO"; break;
    case "ACEPTAR": requireState("COTIZADO"); next.accepted = true; next.state = "APROBADO"; break;
    case "ANTICIPO": requireState("APROBADO"); if (!job.accepted) throw new Error("Falta la aceptación del cliente."); next.paid = job.minimum; next.state = "ANTICIPO_RECIBIDO"; break;
    case "INICIAR": requireState("ANTICIPO_RECIBIDO"); if (!job.accepted || !job.technician || job.paid < job.minimum) throw new Error("Para empezar necesitas aceptación, técnico y anticipo suficiente."); next.state = "EN_PROCESO"; break;
    case "MATERIALES": requireState("EN_PROCESO"); if (job.materialsRecorded || !job.materialCost) throw new Error("Los materiales de este ejemplo ya están registrados."); next.materialsRecorded = true; break;
    case "FINALIZAR": requireState("EN_PROCESO"); if (job.materialCost && !job.materialsRecorded) throw new Error("Registra los materiales del ejemplo antes de continuar."); next.state = "TERMINADO_TECNICO"; break;
    case "VALIDAR": requireState("TERMINADO_TECNICO"); next.quality = true; next.state = "VALIDADO"; break;
    case "SALDO": requireState("VALIDADO"); if (job.paid >= job.total) throw new Error("El ejemplo ya está pagado."); next.paid = job.total; break;
    case "CERRAR": requireState("VALIDADO"); if (!job.quality || job.paid !== job.total) throw new Error("El cierre requiere calidad aprobada y saldo cero."); next.closed = true; next.state = "FINALIZADO_FINANCIERO"; break;
    default: throw new Error("Acción de práctica inválida.");
  }
  return next;
}
export function createExample(id: string): PracticeJob {
  const example = examples.find(item => item.id === id);
  if (!example) throw new Error("Ejemplo no encontrado.");
  const initial: PracticeJob = { ...example, initial: [...example.initial], state: example.direct ? "EVALUADO" : "BORRADOR", paid: 0, technician: example.direct ? "Técnico ficticio B" : null, accepted: false, materialsRecorded: false, quality: false, closed: false };
  return example.initial.reduce(advancePractice, initial);
}
export function nextPracticeAction(job: PracticeJob): { event: PracticeEvent; label: string; instruction: string; role: string } | null {
  const actions = {
    BORRADOR: { event: "AGENDAR", label: "Coordinar visita de ejemplo", instruction: "Primero consulta las agendas y la preferencia del cliente. En esta práctica asignaremos un técnico ficticio, sin reservar horas reales.", role: "Encargado" },
    EVALUACION_PENDIENTE: { event: "EVALUAR", label: "Registrar evaluación de ejemplo", instruction: "En el trabajo real el técnico documenta medidas, condiciones y fotos antes del presupuesto. Aquí usaremos una evaluación simulada.", role: "Técnico" },
    EVALUADO: { event: "COTIZAR", label: "Preparar presupuesto de ejemplo", instruction: "Revisa materiales, mano de obra y transporte. Los importes de esta práctica son ficticios y no cambian tus tarifas.", role: "Encargado" },
    COTIZADO: { event: "ACEPTAR", label: "Simular aceptación del cliente", instruction: "Registrar un pago no reemplaza la aceptación del presupuesto. Confirma la respuesta del cliente antes de iniciar.", role: "Encargado" },
    APROBADO: { event: "ANTICIPO", label: "Registrar anticipo simulado", instruction: "El cliente ya aceptó. Registra el anticipo requerido; en este ejemplo no se mueve dinero real.", role: "Encargado" },
    ANTICIPO_RECIBIDO: { event: "INICIAR", label: "Iniciar trabajo de ejemplo", instruction: "Comprueba que haya técnico asignado, aceptación y anticipo suficiente antes de empezar.", role: "Técnico / Encargado" },
    EN_PROCESO: job.materialCost && !job.materialsRecorded ? { event: "MATERIALES", label: "Registrar materiales simulados", instruction: "En un trabajo real debes elegir el almacén o tienda de salida. Aquí simularemos el consumo, sin descontar inventario.", role: "Técnico" } : { event: "FINALIZAR", label: "Simular finalización técnica", instruction: "En el trabajo real adjunta fotos y describe lo realizado. La finalización técnica pasa a revisión de calidad, todavía no al cierre financiero.", role: "Técnico" },
    TERMINADO_TECNICO: { event: "VALIDAR", label: "Simular revisión de calidad", instruction: "El encargado revisa la calidad y las evidencias. El técnico no debe aprobar su propia revisión de calidad.", role: "Encargado / Administrador" },
    VALIDADO: job.paid < job.total ? { event: "SALDO", label: "Cobrar saldo simulado", instruction: "Revisa el saldo restante antes de cerrar. El ejemplo registra un cobro ficticio hasta completar el total.", role: "Encargado" } : { event: "CERRAR", label: "Cerrar trabajo de ejemplo", instruction: "Con calidad aprobada, costos revisados y saldo cero puedes cerrar. Aquí verás un resumen ficticio; no se emiten documentos reales.", role: "Encargado / Administrador" },
  };
  return (actions as Record<string, { event: PracticeEvent; label: string; instruction: string; role: string }>)[job.state] || null;
}
export type PracticeHistory = Partial<Record<ExampleId, PracticeEvent[]>>;
export function restorePractice(raw: string): PracticeHistory {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const restored: PracticeHistory = {};
    for (const example of examples) {
      const history = parsed[example.id];
      if (!Array.isArray(history) || history.length > 20 || history.some(item => typeof item !== "string")) continue;
      try { history.reduce(advancePractice, createExample(example.id)); restored[example.id] = history; } catch { /* Discard only the invalid example. */ }
    }
    return restored;
  } catch { return {}; }
}

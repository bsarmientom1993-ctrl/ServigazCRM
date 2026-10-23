export type PracticeState = "BORRADOR" | "EVALUACION_PENDIENTE" | "EVALUADO" | "COTIZADO" | "APROBADO" | "ANTICIPO_RECIBIDO" | "EN_PROCESO" | "TERMINADO_TECNICO" | "VALIDADO" | "FINALIZADO_FINANCIERO";
export type PracticeEvent = "AGENDAR" | "EVALUAR" | "COTIZAR" | "ACEPTAR" | "ANTICIPO" | "INICIAR" | "MATERIALES" | "FINALIZAR" | "VALIDAR" | "SALDO" | "CERRAR" | "CORREGIR_PROYECTO" | "REVISAR_PROYECTO" | "PRESENTAR_PROYECTO" | "SEGUIMIENTO_PROYECTO" | "APROBAR_PROYECTO" | "ENTREGAR_PROYECTO";
export type ExampleId = "gas" | "plomeria" | "calefaccion" | "directo" | "calefon" | "equipos" | "equipo-instalacion" | "gas-proyecto" | "calidad" | "cerrado";
export type PracticeProjectStage = "OBSERVADO" | "EN_ELABORACION" | "EN_REVISION" | "PRESENTADO" | "APROBADO" | "ENTREGADO";
export const practiceProjectLabels: Record<PracticeProjectStage, string> = { OBSERVADO: "Con observaciones de la entidad", EN_ELABORACION: "En corrección", EN_REVISION: "En revisión del supervisor", PRESENTADO: "Presentado a la entidad", APROBADO: "Aprobación registrada", ENTREGADO: "Proyecto entregado" };
export type Example = { id: ExampleId; code: string; service: string; customer: string; description: string; total: number; minimum: number; materialCost: number; laborCost: number; transportCost: number; direct: boolean; deliveryOnly?: boolean; projectStart?: PracticeProjectStage; initial: PracticeEvent[] };
export type PracticeJob = Example & { state: PracticeState; paid: number; technician: string | null; accepted: boolean; materialsRecorded: boolean; quality: boolean; closed: boolean; projectStage: PracticeProjectStage | null; projectHistory: string[]; projectFollowUps: number };
const throughExecution: PracticeEvent[] = ["AGENDAR", "EVALUAR", "COTIZAR", "ACEPTAR", "ANTICIPO", "INICIAR", "MATERIALES", "FINALIZAR"];
export const examples: Example[] = [
  { id: "gas", code: "EJEMPLO-001", service: "Instalación de gas", customer: "Cliente ficticio 01", description: "Este caso comienza como una solicitud nueva. Practica coordinar la visita, evaluar y recorrer el trabajo hasta el cierre.", total: 240000, minimum: 120000, materialCost: 85000, laborCost: 70000, transportCost: 15000, direct: false, initial: [] },
  { id: "plomeria", code: "EJEMPLO-002", service: "Reparación de plomería", customer: "Cliente ficticio 02", description: "Este caso comienza con el presupuesto preparado. Practica la aceptación del cliente y el anticipo antes de empezar.", total: 65000, minimum: 32500, materialCost: 12000, laborCost: 22000, transportCost: 4000, direct: false, initial: ["AGENDAR", "EVALUAR", "COTIZAR"] },
  { id: "calefaccion", code: "EJEMPLO-003", service: "Mantenimiento de calefacción", customer: "Cliente ficticio 03", description: "Este caso comienza con un trabajo en ejecución. Practica registrar materiales, finalizar, validar calidad y cobrar el saldo.", total: 120000, minimum: 60000, materialCost: 22000, laborCost: 35000, transportCost: 5000, direct: false, initial: ["AGENDAR", "EVALUAR", "COTIZAR", "ACEPTAR", "ANTICIPO", "INICIAR"] },
  { id: "directo", code: "EJEMPLO-004", service: "Otro: revisión de equipo", customer: "Cliente ficticio 04", description: "Un servicio directo sin medición. Practica cotizar, cobrar el total y cerrar después de validar la calidad.", total: 18000, minimum: 18000, materialCost: 0, laborCost: 8000, transportCost: 2000, direct: true, initial: [] },
  { id: "calefon", code: "EJEMPLO-005", service: "Mantenimiento de calefón", customer: "Cliente ficticio 05", description: "Visita de diagnóstico coordinada. Revisa el contacto, las indicaciones de acceso y las fotos del requerimiento antes de evaluar el calefón.", total: 35000, minimum: 17500, materialCost: 4500, laborCost: 15000, transportCost: 3000, direct: false, initial: ["AGENDAR"] },
  { id: "equipos", code: "EJEMPLO-006", service: "Provisión de equipo sin instalación", customer: "Cliente ficticio 06", description: "El cliente aceptó la compra de un calefón. Practica cobrar el total, preparar la salida desde la tienda y verificar la entrega; no incluye instalación.", total: 180000, minimum: 180000, materialCost: 125000, laborCost: 0, transportCost: 5000, direct: true, deliveryOnly: true, initial: ["COTIZAR", "ACEPTAR"] },
  { id: "equipo-instalacion", code: "EJEMPLO-007", service: "Provisión de equipo con instalación", customer: "Cliente ficticio 07", description: "Anticipo completo y técnico asignado. Prepara equipo y accesorios desde el almacén, instala y documenta el resultado para la revisión del encargado.", total: 265000, minimum: 132500, materialCost: 155000, laborCost: 40000, transportCost: 8000, direct: false, initial: ["AGENDAR", "EVALUAR", "COTIZAR", "ACEPTAR", "ANTICIPO"] },
  { id: "gas-proyecto", code: "EJEMPLO-008", service: "Instalación de gas con proyecto observado", customer: "Cliente ficticio 08", description: "La instalación ya está validada y pagada, pero la entidad observó el proyecto. Practica las correcciones y el seguimiento exclusivo del proyecto. El cierre espera su entrega.", total: 480000, minimum: 240000, materialCost: 140000, laborCost: 150000, transportCost: 12000, direct: false, projectStart: "OBSERVADO", initial: [...throughExecution, "VALIDAR", "SALDO"] },
  { id: "calidad", code: "EJEMPLO-009", service: "Instalación menor de gas sin proyecto", customer: "Cliente ficticio 09", description: "El técnico terminó una instalación menor que no incluye proyecto. El encargado revisa las fotos finales y la calidad antes de cobrar el saldo y cerrar.", total: 85000, minimum: 42500, materialCost: 25000, laborCost: 22000, transportCost: 5000, direct: false, initial: [...throughExecution] },
  { id: "cerrado", code: "EJEMPLO-010", service: "Instalación de gas cerrada y con proyecto entregado", customer: "Cliente ficticio 10", description: "Caso completo: evaluación, cotización aceptada, pagos conciliados, instalación validada y proyecto entregado. Consulta el resultado final de un trabajo que ya completó todas sus etapas.", total: 390000, minimum: 195000, materialCost: 110000, laborCost: 120000, transportCost: 10000, direct: false, projectStart: "ENTREGADO", initial: [...throughExecution, "VALIDAR", "SALDO", "CERRAR"] },
];
export function advancePractice(job: PracticeJob, event: PracticeEvent): PracticeJob {
  const next = { ...job, projectHistory: [...job.projectHistory] };
  const requireState = (...states: PracticeState[]) => { if (!states.includes(job.state)) throw new Error("Completa primero el paso indicado para esta orden de ejemplo."); };
  const projectStep = (from: PracticeProjectStage, to: PracticeProjectStage, detail: string) => {
    if (job.closed || job.projectStage !== from) throw new Error("Revisa el estado actual del proyecto antes de continuar.");
    next.projectStage = to; next.projectHistory.push(detail);
  };
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
    case "CORREGIR_PROYECTO": projectStep("OBSERVADO", "EN_ELABORACION", "Encargado: inicia la corrección de planos y medidas solicitada por la entidad."); break;
    case "REVISAR_PROYECTO": projectStep("EN_ELABORACION", "EN_REVISION", "Encargado: adjunta correcciones para revisión del supervisor."); break;
    case "PRESENTAR_PROYECTO": projectStep("EN_REVISION", "PRESENTADO", "Supervisor: verifica las correcciones y registra la nueva presentación a la entidad."); break;
    case "SEGUIMIENTO_PROYECTO":
      if (job.closed || job.projectStage !== "PRESENTADO" || job.projectFollowUps) throw new Error("El seguimiento de este ejemplo ya está registrado o no corresponde a esta etapa.");
      next.projectFollowUps++; next.projectHistory.push("Encargado: seguimiento diario registrado; la entidad continúa revisando. No cambia la aprobación."); break;
    case "APROBAR_PROYECTO":
      if (!job.projectFollowUps) throw new Error("Registra primero el seguimiento de este ejemplo.");
      projectStep("PRESENTADO", "APROBADO", "Encargado: registra la aprobación recibida de la entidad (respuesta simulada)."); break;
    case "ENTREGAR_PROYECTO": projectStep("APROBADO", "ENTREGADO", "Encargado: registra la entrega del proyecto aprobado al cliente."); break;
    case "CERRAR": requireState("VALIDADO"); if (!job.quality || job.paid !== job.total) throw new Error("El cierre requiere calidad aprobada y saldo cero."); if (job.projectStage && job.projectStage !== "ENTREGADO") throw new Error("El proyecto debe estar entregado antes del cierre final."); next.closed = true; next.state = "FINALIZADO_FINANCIERO"; break;
    default: throw new Error("Acción de práctica inválida.");
  }
  return next;
}
export function createExample(id: string): PracticeJob {
  const example = examples.find(item => item.id === id);
  if (!example) throw new Error("Ejemplo no encontrado.");
  const initial: PracticeJob = { ...example, initial: [...example.initial], state: example.direct ? "EVALUADO" : "BORRADOR", paid: 0, technician: example.direct ? "Técnico ficticio B" : null, accepted: false, materialsRecorded: false, quality: false, closed: false, projectStage: example.projectStart || null, projectFollowUps: 0, projectHistory: example.projectStart === "OBSERVADO" ? ["Entidad: observa el plano y solicita corregir el trazado. Registro ficticio del proyecto."] : example.projectStart === "ENTREGADO" ? ["Entidad: aprobación registrada en el historial ficticio.", "Encargado: proyecto aprobado entregado al cliente."] : [] };
  return example.initial.reduce(advancePractice, initial);
}
export function nextPracticeAction(job: PracticeJob): { event: PracticeEvent; label: string; instruction: string; role: string } | null {
  if (job.state === "VALIDADO" && job.paid === job.total && job.projectStage && job.projectStage !== "ENTREGADO") {
    const projectActions: Record<string, { event: PracticeEvent; label: string; instruction: string }> = {
      OBSERVADO: { event: "CORREGIR_PROYECTO", label: "Registrar corrección del proyecto", instruction: "La instalación está terminada. Registra la observación de la entidad y la corrección en el historial exclusivo del proyecto." },
      EN_ELABORACION: { event: "REVISAR_PROYECTO", label: "Enviar corrección al supervisor", instruction: "Documenta los cambios de planos y medidas para que el encargado o administrador revise antes de presentar nuevamente." },
      EN_REVISION: { event: "PRESENTAR_PROYECTO", label: "Simular nueva presentación", instruction: "Registra la presentación del proyecto corregido. Esto todavía no significa que la entidad lo haya aprobado." },
      PRESENTADO: job.projectFollowUps ? { event: "APROBAR_PROYECTO", label: "Registrar respuesta favorable simulada", instruction: "En la operación real este proceso puede tardar. Solo registra la aprobación cuando la entidad la comunique; aquí simularemos esa respuesta." } : { event: "SEGUIMIENTO_PROYECTO", label: "Registrar seguimiento diario de ejemplo", instruction: "Registra la consulta y la próxima gestión en el historial del proyecto. Dar seguimiento no cambia su aprobación." },
      APROBADO: { event: "ENTREGAR_PROYECTO", label: "Registrar entrega del proyecto", instruction: "La aprobación y la entrega son etapas distintas. Deja constancia de la entrega al cliente para habilitar el cierre final." },
    };
    return { ...projectActions[job.projectStage], role: "Encargado / Administrador" };
  }
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
  const action = (actions as Record<string, { event: PracticeEvent; label: string; instruction: string; role: string }>)[job.state] || null;
  if (job.deliveryOnly && action) {
    const delivery: Partial<Record<PracticeEvent, { label: string; instruction: string }>> = {
      INICIAR: { label: "Preparar entrega del equipo", instruction: "La venta está aceptada y pagada. Verifica equipo y accesorios para la entrega desde la tienda; esta compra no incluye instalación." },
      MATERIALES: { label: "Registrar salida simulada del equipo", instruction: "Comprueba disponibilidad en la tienda de la sucursal. Esta práctica simula la salida del equipo sin modificar existencias reales." },
      FINALIZAR: { label: "Registrar entrega simulada al cliente", instruction: "Deja constancia del equipo y accesorios entregados. No se registra una instalación en este caso." },
      VALIDAR: { label: "Verificar conformidad de la entrega", instruction: "El encargado revisa modelo, accesorios y conformidad del cliente antes del cierre de la venta." },
    };
    return { ...action, ...delivery[action.event], role: "Encargado / Administrador" };
  }
  return action;
}
export type PracticeHistory = Partial<Record<ExampleId, PracticeEvent[]>>;
export function restorePractice(raw: string): PracticeHistory {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const restored: PracticeHistory = {};
    for (const example of examples) {
      const history = parsed[example.id];
      if (!Array.isArray(history) || history.length > 40 || history.some(item => typeof item !== "string")) continue;
      try { history.reduce(advancePractice, createExample(example.id)); restored[example.id] = history; } catch { /* Discard only the invalid example. */ }
    }
    return restored;
  } catch { return {}; }
}

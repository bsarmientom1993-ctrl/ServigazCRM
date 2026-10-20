export const projectStages = ["PENDIENTE", "EN_ELABORACION", "EN_REVISION", "PRESENTADO", "OBSERVADO", "APROBADO", "ENTREGADO"] as const;
export type ProjectStage = typeof projectStages[number];
export const projectLabels: Record<ProjectStage, string> = { PENDIENTE: "Pendiente", EN_ELABORACION: "En elaboración", EN_REVISION: "En revisión", PRESENTADO: "Presentado", OBSERVADO: "Con observaciones", APROBADO: "Aprobación registrada", ENTREGADO: "Entregado" };
export type GasRates = { materialVisto: number; materialEmpotrado: number; manoObraVisto: number; manoObraEmpotrado: number; factorManoObra: number; importeProyecto: number };
export type GasReview = { estado: "APROBADO" | "CORRECCION_SOLICITADA" | "PENDIENTE"; visitaId: string; huella: string; supervisorId: string; supervisorNombre: string; fecha: string; criterio: string; metrosVisto: number; metrosEmpotrado: number; tarifas: GasRates; incluyeProyecto: boolean };
export type GasProject = { incluido: boolean; estado: ProjectStage; responsable: string; fechaObjetivo: string; referencia: string; observaciones: string; documentosUrls: string[]; actualizado?: string };
export type GasData = { calculo?: { subtotalMateriales: string; subtotalManoObra: string; manoObraLineal: string; importeProyecto: string; promedioPorMetro: string; metrosTotales: number }; aplica?: boolean; proyecto?: GasProject; supervision?: GasReview };
export function objectRecord(value: unknown): Record<string, any> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {}; }
export function gasData(work: { fechasSla?: unknown }): GasData { return objectRecord(objectRecord(work.fechasSla).gas); }
export function isGasWork(work: { fechasSla?: unknown; subtipoCodigo?: string; subtipoNombre?: string }) {
  return gasData(work).aplica === true || (work.subtipoCodigo || "").split("_").some(code => code.startsWith("1.1.")) || /\bgas\b/i.test(work.subtipoNombre || "");
}
export function newGasProject(included: boolean): GasProject { return { incluido: included, estado: "PENDIENTE", responsable: "", fechaObjetivo: "", referencia: "", observaciones: "", documentosUrls: [] }; }
export const projectTransitions: Record<ProjectStage, ProjectStage[]> = { PENDIENTE: ["EN_ELABORACION"], EN_ELABORACION: ["EN_REVISION"], EN_REVISION: ["PRESENTADO", "OBSERVADO"], PRESENTADO: ["APROBADO", "OBSERVADO"], OBSERVADO: ["EN_ELABORACION"], APROBADO: ["ENTREGADO"], ENTREGADO: [] };

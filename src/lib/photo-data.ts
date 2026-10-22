export const photoStages = ["INICIAL", "FINAL"] as const;
export type PhotoStage = typeof photoStages[number];
export const photoStageLabels = { INICIAL: "Requerimiento inicial", FINAL: "Instalación terminada" };
export const photoLimit = 20;

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "./api";
import { cents } from "./workflow-policy";
import { gasData, GasReview, objectRecord } from "./gas-data";
const price = z.number().finite().nonnegative().max(99999999.99).refine(value => { try { cents(value); return true; } catch { return false; } }, "Los importes admiten hasta dos decimales.");
export const gasRatesSchema = z.object({ materialVisto: price, materialEmpotrado: price, manoObraVisto: price, manoObraEmpotrado: price, factorManoObra: z.number().finite().min(1).max(5).multipleOf(0.01), importeProyecto: price });
export function evaluationFingerprint(visit: { id: string; fechaEjecutada: Date | null; medidasJson: unknown; condicionesJson: unknown; fotosUrls: unknown; dificultadSugerida: number }) {
  return createHash("sha256").update(JSON.stringify({ id: visit.id, fecha: visit.fechaEjecutada?.toISOString(), medidas: visit.medidasJson, condiciones: visit.condicionesJson, fotos: visit.fotosUrls, dificultad: visit.dificultadSugerida })).digest("hex");
}
export function calculateGas(review: GasReview) {
  const rates = gasRatesSchema.parse(review.tarifas);
  const visible = new Prisma.Decimal(review.metrosVisto), embedded = new Prisma.Decimal(review.metrosEmpotrado);
  if (!visible.isFinite() || !embedded.isFinite() || visible.lt(0) || embedded.lt(0) || visible.add(embedded).lte(0) || visible.decimalPlaces() > 2 || embedded.decimalPlaces() > 2) throw new ApiError(409, "La medición de gas debe contener metros lineales válidos.");
  const material = visible.mul(rates.materialVisto).add(embedded.mul(rates.materialEmpotrado)).toDecimalPlaces(2);
  const labor = visible.mul(rates.manoObraVisto).add(embedded.mul(rates.manoObraEmpotrado)).mul(rates.factorManoObra).toDecimalPlaces(2);
  const project = new Prisma.Decimal(review.incluyeProyecto ? rates.importeProyecto : 0);
  const linear = material.add(labor);
  return { metrosVisto: visible.toNumber(), metrosEmpotrado: embedded.toNumber(), metrosTotales: visible.add(embedded).toNumber(), subtotalMateriales: material.toFixed(2), manoObraLineal: labor.toFixed(2), importeProyecto: project.toFixed(2), subtotalManoObra: labor.add(project).toFixed(2), promedioPorMetro: linear.div(visible.add(embedded)).toDecimalPlaces(2).toFixed(2), tarifas: rates };
}
export async function approvedGasCalculation(tx: Prisma.TransactionClient, work: { id: string; fechasSla: unknown }) {
  const gas = gasData(work), review = gas.supervision;
  if (!review || review.estado !== "APROBADO") throw new ApiError(409, "El supervisor debe dar el visto bueno a la medición de gas antes de emitir la cotización.");
  const visit = await tx.visitaTecnica.findFirst({ where: { trabajoId: work.id, completada: true }, orderBy: [{ fechaEjecutada: "desc" }, { createdAt: "desc" }] });
  if (!visit || visit.id !== review.visitaId || review.supervisorId === visit.tecnicoId || evaluationFingerprint(visit) !== review.huella || review.incluyeProyecto !== !!gas.proyecto?.incluido) throw new ApiError(409, "La evaluación o el alcance cambiaron. Solicita nuevamente el visto bueno del supervisor.");
  const measure = objectRecord(visit.medidasJson);
  if (Number(measure.metrosVisto) !== review.metrosVisto || Number(measure.metrosEmpotrado) !== review.metrosEmpotrado) throw new ApiError(409, "Los metros aprobados no coinciden con la medición del técnico.");
  return { ...calculateGas(review), supervision: review };
}

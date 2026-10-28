import { projectScope, commercialOrigin, isIndependentProject } from "@/lib/work-responsibility";
import { NextRequest, NextResponse } from "next/server";
import { requireSession, managers, workScope } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { gasData } from "@/lib/gas-data";
import { agendaDay } from "@/lib/technician-agenda";

export async function GET(req: NextRequest) {
  try {
    const user = await requireSession(req);
    const works = await prisma.trabajo.findMany({ where: { AND: [projectScope(user), { fechasSla: { path: ["gas", "proyecto", "incluido"], equals: true } }] }, select: { id: true, codigoCorrelativo: true, estado: true, fechasSla: true, cliente: { select: { nombreCompleto: true } }, encargado: { select: { nombre: true } } }, orderBy: { updatedAt: "desc" } });
    return NextResponse.json({ hoy: agendaDay(), proyectos: works.map(work => ({ id: work.id, codigo: work.codigoCorrelativo, estadoTrabajo: work.estado, cliente: work.cliente.nombreCompleto, encargado: work.encargado.nombre, independiente: isIndependentProject(work), captadoPor: commercialOrigin(work), proyecto: gasData(work).proyecto })) });
  } catch (error) { return apiError(error); }
}

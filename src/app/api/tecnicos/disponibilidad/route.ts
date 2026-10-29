import {assignedRoleWhere} from '@/lib/auth';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, managers } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/api";
import { localParts, reservationEnd, schedulingSchema, slotConflicts, technicianReservations, withinWorkingHours, workingHours } from "@/lib/scheduling";

export async function GET(req: NextRequest) {
  try {
    const user = await requireSession(req, managers);
    const params = req.nextUrl.searchParams;
    const start = new Date(z.string().datetime({ offset: true }).parse(params.get("desde")));
    const end = new Date(z.string().datetime({ offset: true }).parse(params.get("hasta")));
    if (end <= start || end.getTime() - start.getTime() > 26 * 3600000) throw new ApiError(400, "Consulta un día de agenda a la vez.");
    const config = schedulingSchema.parse({ duracionMinutos: Number(params.get("duracionMinutos") || 60), margenMinutos: Number(params.get("margenMinutos") || 30), zonaHoraria: params.get("zonaHoraria") || undefined });
    if (localParts(start, config.zonaHoraria).day !== localParts(new Date(end.getTime() - 1), config.zonaHoraria).day) throw new ApiError(400, "Consulta un solo día de agenda.");
    const result = await prisma.$transaction(async tx => {
      const technicians = await tx.usuario.findMany({ where: { ...assignedRoleWhere("TECNICO_FIJO"), estado: "ACTIVO", ...(user.rol === "ADMIN" ? {} : { sucursalId: user.sucursalId }) }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } });
      const hours = await workingHours(tx);
      const visits = await technicianReservations(tx, technicians.map(t => t.id), start, end);
      const day = localParts(start, config.zonaHoraria).day;
      const leaves = await tx.permisoPersonal.findMany({ where: { usuarioId: { in: technicians.map(t => t.id) }, estado: "APROBADO", fechaPermiso: new Date(day + "T00:00:00Z") }, select: { usuarioId: true } });
      return { jornada: hours, zonaHoraria: config.zonaHoraria, tecnicos: technicians.map(tech => {
        const busy = visits.filter(v => v.tecnicoId === tech.id);
        const permiso = leaves.some(l => l.usuarioId === tech.id);
        const slots: { inicio: string; fin: string }[] = [];
        for (let time = start.getTime(); time + config.duracionMinutos * 60000 <= end.getTime(); time += 30 * 60000) {
          const date = new Date(time);
          if (!permiso && time > Date.now() && withinWorkingHours(date, config, hours) && !slotConflicts(date, config, busy)) slots.push({ inicio: date.toISOString(), fin: new Date(time + config.duracionMinutos * 60000).toISOString() });
        }
        return { ...tech, permiso, ocupaciones: busy.map(v => ({ inicio: v.fechaProgramada.toISOString(), fin: new Date(reservationEnd(v)).toISOString() })), horarios: slots };
      }) };
    });
    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}

import {roleApiAllowed} from "./role-access";
import { activeRole, UserRole } from './user-roles';
import { NextRequest } from "next/server";
import * as jwt from "jsonwebtoken";
import { RolUsuario, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { ApiError } from "./api";
import {hasDailyEntry,attendanceSetupPath} from './attendance-access';

export function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new ApiError(503, "El acceso no está configurado. Contacta al administrador.");
  return secret;
}

export async function requireSession(req: NextRequest, roles?: RolUsuario[]) {
  const token = req.cookies.get("servigaz_token")?.value;
  if (!token) throw new ApiError(401, "Inicia sesión para continuar.");
  const secret = jwtSecret();
  let userId: string;
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (typeof decoded === "string" || typeof decoded.id !== "string") throw new Error();
    userId = decoded.id;
  } catch {
    throw new ApiError(401, "Tu sesión venció. Inicia sesión nuevamente.");
  }
  const user = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { id: true, rol: true, rolesAsignados:true, estado: true, sucursalId: true },
  });
  if (!user || user.estado !== "ACTIVO") throw new ApiError(401, "La cuenta no está activa.");
  const selected=activeRole(user,req.cookies.get('servigaz_rol')?.value);
  if(!selected)throw new ApiError(401,'La cuenta no tiene roles asignados. Contacta al administrador.');
  if (!roleApiAllowed(selected,req.nextUrl.pathname,req.method)) throw new ApiError(403,"Tu rol activo no permite acceder a este apartado.");
  if(['VENTAS','SUPERVISOR','CAJA'].includes(selected)&&!user.sucursalId&&!req.nextUrl.pathname.startsWith('/api/auth/')&&req.nextUrl.pathname!=='/api/comisiones'&&!req.nextUrl.pathname.startsWith('/api/notificaciones')&&!req.nextUrl.pathname.startsWith('/api/personal'))throw new ApiError(403,'El administrador debe asignarte una sucursal antes de operar con este rol.');
  if (roles && !roles.includes(selected)) throw new ApiError(403, "Tu rol no permite esta acción.");
  if(!attendanceSetupPath(req.nextUrl.pathname)&&!await hasDailyEntry(prisma,user.id))throw new ApiError(428,'Registra tu entrada de hoy en Asistencia antes de acceder al sistema.');
  return {id:user.id,rol:selected,estado:user.estado,sucursalId:user.sucursalId};
}

export function assignedRoleWhere(role:UserRole):Prisma.UsuarioWhereInput{return {OR:[{rolesAsignados:{array_contains:[role]}},{rol:role,rolesAsignados:{equals:Prisma.DbNull}}]};}

export type Session = Awaited<ReturnType<typeof requireSession>>;
export const inventoryOperators: RolUsuario[] = ["ADMIN","ENCARGADO","ENCARGADO_TIENDA","ALMACENERO"];
export const managers: RolUsuario[] = ["ADMIN", "ENCARGADO"];
export const intakeOperators:RolUsuario[]=['ADMIN','ENCARGADO','VENTAS'];
export const proformaOperators:RolUsuario[]=['ADMIN','ENCARGADO','VENTAS','ENCARGADO_TIENDA'];
export const paymentOperators:RolUsuario[]=['ADMIN','ENCARGADO','CAJA'];

export function workScope(user: Session): Prisma.TrabajoWhereInput {
  if (["ENCARGADO_TIENDA","ALMACENERO","GESTOR_PROYECTOS"].includes(user.rol)) throw new ApiError(403,"No tienes acceso al expediente comercial del trabajo.");
  if (user.rol === "ADMIN") return {};
  if (user.rol === "TECNICO_FIJO") return { tecnicoId: user.id };
  // A manager without a branch can only access their own orders.
  return user.sucursalId ? { OR: [{ sucursalId: user.sucursalId }, { encargadoId: user.id }] } : { encargadoId: user.id };
}

export function assertWorkAccess(user: Session, work: { tecnicoId: string | null; encargadoId: string; sucursalId: string | null }) {
  if (["ENCARGADO_TIENDA","ALMACENERO","GESTOR_PROYECTOS"].includes(user.rol)) throw new ApiError(403,"No tienes acceso a esta orden.");
  if (user.rol === "ADMIN") return;
  if (user.rol === "TECNICO_FIJO" ? work.tecnicoId === user.id :
    work.encargadoId === user.id || Boolean(user.sucursalId && user.sucursalId === work.sucursalId)) return;
  throw new ApiError(403, "Esta orden no está asignada a tu ámbito de trabajo.");
}


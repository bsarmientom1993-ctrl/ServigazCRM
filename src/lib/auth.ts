import {storeApiAllowed} from "./store-role";
import { NextRequest } from "next/server";
import * as jwt from "jsonwebtoken";
import { RolUsuario, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { ApiError } from "./api";

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
    select: { id: true, rol: true, estado: true, sucursalId: true },
  });
  if (!user || user.estado !== "ACTIVO") throw new ApiError(401, "La cuenta no está activa.");
  if (user.rol === "ENCARGADO_TIENDA" && !storeApiAllowed(req.nextUrl.pathname,req.method)) throw new ApiError(403,"Tu acceso está limitado al inventario y las operaciones de las tiendas.");
  if (roles && !roles.includes(user.rol)) throw new ApiError(403, "Tu rol no permite esta acción.");
  return user;
}

export type Session = Awaited<ReturnType<typeof requireSession>>;
export const inventoryOperators: RolUsuario[] = ["ADMIN","ENCARGADO","ENCARGADO_TIENDA"];
export const managers: RolUsuario[] = ["ADMIN", "ENCARGADO"];

export function workScope(user: Session): Prisma.TrabajoWhereInput {
  if (user.rol === "ENCARGADO_TIENDA") throw new ApiError(403,"No tienes acceso a trabajos ni cotizaciones.");
  if (user.rol === "ADMIN") return {};
  if (user.rol === "TECNICO_FIJO") return { tecnicoId: user.id };
  // A manager without a branch can only access their own orders.
  return user.sucursalId ? { OR: [{ sucursalId: user.sucursalId }, { encargadoId: user.id }] } : { encargadoId: user.id };
}

export function assertWorkAccess(user: Session, work: { tecnicoId: string | null; encargadoId: string; sucursalId: string | null }) {
  if (user.rol === "ENCARGADO_TIENDA") throw new ApiError(403,"No tienes acceso a esta orden.");
  if (user.rol === "ADMIN") return;
  if (user.rol === "TECNICO_FIJO" ? work.tecnicoId === user.id :
    work.encargadoId === user.id || Boolean(user.sucursalId && user.sucursalId === work.sucursalId)) return;
  throw new ApiError(403, "Esta orden no está asignada a tu ámbito de trabajo.");
}


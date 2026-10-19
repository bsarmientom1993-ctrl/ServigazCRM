import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { ApiError } from "./api";
import { assertWorkAccess, Session } from "./auth";

export async function withWork<T>(id: string, user: Session, action: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    // Serialize all financial and operational mutations for this order.
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Trabajo" WHERE id = ${id} FOR UPDATE`;
    if (!rows.length) throw new ApiError(404, "Trabajo no encontrado.");
    const work = await tx.trabajo.findUniqueOrThrow({ where: { id } });
    assertWorkAccess(user, work);
    return action(tx);
  }, { timeout: 15000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}


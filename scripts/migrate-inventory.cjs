const { PrismaClient } = require("@prisma/client");
const fs = require("node:fs");
const path = require("node:path");
function databaseUrl(env) {
  const keys = ["DATABASE_URL", "POSTGRES_PRISMA_URL", "STORAGE_PRISMA_URL", "NEON_DATABASE_URL", "NEON_PRISMA_URL", "POSTGRES_URL", "POSTGRES_URL_NON_POOLING", "DATABASE_URL_UNPOOLED", "STORAGE_URL"];
  const urls = keys.map(k => env[k]?.trim()).filter(v => v && /^(postgresql|postgres|prisma|prisma\+postgres):\/\//i.test(v));
  return env.VERCEL === "1" ? urls.find(v => { try { return !["localhost","127.0.0.1","[::1]","::1"].includes(new URL(v).hostname.toLowerCase()); } catch { return false; } }) : urls[0];
}
async function migrateInventory(client) {
  return client.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(742382)`;
    await tx.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "_ServigazInventoryMigration" ("id" TEXT PRIMARY KEY, "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    const done = await tx.$queryRaw`SELECT id FROM "_ServigazInventoryMigration" WHERE id = '001_ubicaciones'`;
    if (done.length) return false;
    const sql = fs.readFileSync(path.join(__dirname, "../prisma/inventory-migrations/001_ubicaciones.sql"), "utf8");
    for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
    await tx.$executeRaw`INSERT INTO "_ServigazInventoryMigration" (id) VALUES ('001_ubicaciones')`;
    return true;
  }, { timeout: 60000, maxWait: 15000 });
}
module.exports = { migrateInventory, databaseUrl };
if (require.main === module) {
  const url = databaseUrl(process.env);
  if (!url) { console.error("No hay conexión PostgreSQL configurada para actualizar el inventario."); process.exitCode = 1; }
  else {
    const client = new PrismaClient({ datasources: { db: { url } } });
    migrateInventory(client).then(changed => console.log(changed ? "Inventario por ubicaciones actualizado. Stock previo conservado." : "Inventario por ubicaciones ya actualizado."))
      .catch(error => { console.error("No se pudo actualizar el inventario:", error.code || error.name); process.exitCode = 1; })
      .finally(() => client.$disconnect());
  }
}

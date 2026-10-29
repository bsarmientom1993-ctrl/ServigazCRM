const { execSync } = require("child_process");
execSync("npx prisma generate", { stdio: "inherit" });
if (process.env.VERCEL === "1") {
  execSync("node scripts/migrate-store-role.cjs", { stdio: "inherit" });
  execSync("node scripts/migrate-operational-roles.cjs", { stdio: "inherit" });
  execSync("node scripts/migrate-user-roles.cjs", { stdio: "inherit" });
  execSync("node scripts/migrate-inventory.cjs", { stdio: "inherit" });
  execSync("node scripts/migrate-proformas.cjs", { stdio: "inherit" });
  execSync("node scripts/migrate-photos.cjs", { stdio: "inherit" });
  execSync("node scripts/migrate-quote-template.cjs", { stdio: "inherit" });
  execSync("node scripts/migrate-store.cjs", { stdio: "inherit" });
  execSync("node scripts/configure-example-catalog.cjs", { stdio: "inherit" });
}
execSync("next build", { stdio: "inherit" });

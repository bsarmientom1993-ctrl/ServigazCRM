const { PrismaClient } = require("@prisma/client");
const { databaseUrl } = require("./migrate-inventory.cjs");
const { configureExampleCatalog } = require("../src/lib/catalog-examples.cjs");
const url = databaseUrl(process.env);
if (!url) { console.error("No hay conexión PostgreSQL configurada para el catálogo."); process.exitCode = 1; }
else {
  const client = new PrismaClient({ datasources: { db: { url } } });
  configureExampleCatalog(client, { once: true })
    .then(result => console.log(result.yaConfigurado ? "Catálogo de ejemplos ya configurado." : "Catálogo configurado: " + result.categoriasCreadas + " categorías y " + result.serviciosCreados + " servicios añadidos. Entradas existentes conservadas."))
    .catch(error => { console.error("No se pudo configurar el catálogo:", error.code || error.name); process.exitCode = 1; })
    .finally(() => client.$disconnect());
}

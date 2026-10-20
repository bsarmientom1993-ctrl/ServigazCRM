const templates = require("../../prisma/catalogo-ejemplos.json");
const VERSION = "catalogo-ejemplos-v2";
const originalCodes = new Set(["GAS", "CALEFACCION", "PLOMERIA", "OTROS"]);
const versions = [
  { id: "catalogo-ejemplos-v1", templates: templates.filter(item => originalCodes.has(item.codigo)) },
  { id: VERSION, templates: templates.filter(item => !originalCodes.has(item.codigo)) },
];
/**
 * Add missing catalog entries; never overwrite names, settings or inactive entries.
 * @param {import("@prisma/client").PrismaClient} client
 * @param {{ once?: boolean, userId?: string | null }} options
 */
async function configureExampleCatalog(client, options = {}) {
  return client.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(742383)`;
    const pending = [];
    if (options.once) {
      for (const version of versions) {
        const applied = await tx.auditoriaLog.findFirst({ where: { modulo: "CATALOGO_SERVICIOS", entidadTipo: "CatalogoEjemplos", entidadId: version.id, accion: "CREATE" } });
        if (!applied) pending.push(version);
      }
      if (!pending.length) return { categoriasCreadas: 0, serviciosCreados: 0, categoriasInactivas: 0, codigosConservados: 0, yaConfigurado: true };
    }
    const selectedTemplates = options.once ? pending.flatMap(version => version.templates) : templates;
    const result = { categoriasCreadas: 0, serviciosCreados: 0, categoriasInactivas: 0, codigosConservados: 0, yaConfigurado: false };
    for (const template of selectedTemplates) {
      const { subtipos, ...fields } = template;
      let category = await tx.catalogoCategoria.findUnique({ where: { codigo: fields.codigo } });
      if (!category) { category = await tx.catalogoCategoria.upsert({ where: { codigo: fields.codigo }, update: {}, create: fields }); result.categoriasCreadas++; }
      if (!category.activo) { result.categoriasInactivas++; continue; }
      for (const [index, subtype] of subtipos.entries()) {
        const existing = await tx.catalogoSubtipo.findUnique({ where: { codigo: subtype.codigo } });
        if (existing) { if (existing.categoriaId !== category.id || !existing.activo) result.codigosConservados++; continue; }
        await tx.catalogoSubtipo.upsert({ where: { codigo: subtype.codigo }, update: {}, create: { ...subtype, categoriaId: category.id, orden: index + 1 } });
        result.serviciosCreados++;
      }
    }
    if (options.once || result.categoriasCreadas || result.serviciosCreados) {
      for (const version of options.once ? pending : [{ id: VERSION }]) await tx.auditoriaLog.create({ data: {
        usuarioId: options.userId || null, modulo: "CATALOGO_SERVICIOS", accion: "CREATE", entidadTipo: "CatalogoEjemplos", entidadId: version.id,
        valoresNuevos: { ...result, origen: options.userId ? "ADMINISTRADOR" : "CONFIGURACION_DESPLIEGUE" },
      } });
    }
    return result;
  }, { timeout: 30000, maxWait: 15000 });
}
module.exports = { configureExampleCatalog };

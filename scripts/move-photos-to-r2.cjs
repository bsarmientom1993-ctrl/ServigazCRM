const { createR2Storage, photoObjectKey, digest } = require('./lib/photo-r2.cjs');

async function movePhotosToR2(client, storage) {
  let moved = 0;
  // Batches keep memory bounded; each object is verified before its binary is cleared.
  while (true) {
    const batch = await client.fotoTrabajo.findMany({ where: { contenido: { not: null } }, select: { id: true, trabajoId: true }, take: 25, orderBy: { id: 'asc' } });
    if (!batch.length) break;
    for (const item of batch) {
      const changed = await client.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "Trabajo" WHERE id = ${item.trabajoId} FOR UPDATE`;
        const photo = await tx.fotoTrabajo.findUnique({ where: { id: item.id } });
        if (!photo?.contenido) return false;
        const bytes = Buffer.from(photo.contenido);
        if (digest(bytes) !== photo.sha256) throw new Error('Legacy photo integrity mismatch');
        const key = photoObjectKey(photo.trabajoId, photo.etapa, photo.id, photo.sha256);
        await storage.put(key, bytes, photo.sha256);
        const restored = await storage.get(key, photo.sha256);
        if (!bytes.equals(restored)) throw new Error('R2 verification failed');
        await tx.fotoTrabajo.update({ where: { id: photo.id }, data: { objectKey: key, contenido: null } });
        return true;
      }, { timeout: 60000, maxWait: 10000 });
      if (changed) moved++;
    }
  }
  return moved;
}
module.exports = { movePhotosToR2 };

if (require.main === module) {
  const { PrismaClient } = require('@prisma/client');
  const { databaseUrl } = require('./migrate-inventory.cjs');
  const url = databaseUrl(process.env);
  if (!url) { console.error('Configura la conexión de la base de datos.'); process.exitCode = 1; }
  else {
    const client = new PrismaClient({ datasources: { db: { url } } });
    let storage;
    (async () => {
      const count = await client.fotoTrabajo.count({ where: { contenido: { not: null } } });
      console.log(`Fotografías pendientes de traslado: ${count}.`);
      if (!process.argv.includes('--apply')) { console.log('Consulta sin cambios. Usa --apply para copiar y verificar cada foto en R2.'); return; }
      if (process.env.PHOTO_STORAGE !== 'r2') throw new Error('Activate R2 before migrating');
      storage = createR2Storage();
      console.log(`Fotografías trasladadas y verificadas: ${await movePhotosToR2(client, storage)}.`);
    })().catch(() => { console.error('Traslado detenido. Las fotos no verificadas conservan su contenido en la base. Revisa la configuración y reintenta; el proceso es reanudable.'); process.exitCode = 1; })
      .finally(async () => { storage?.close(); await client.$disconnect(); });
  }
}

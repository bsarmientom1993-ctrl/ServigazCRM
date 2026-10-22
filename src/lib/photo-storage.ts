import { ApiError } from './api';
import { createR2Storage, photoObjectKey } from '../../scripts/lib/photo-r2.cjs';

// Only server routes import this module. No storage credentials or keys reach the gallery.
export async function storePhoto(workId: string, stage: string, photoId: string, hash: string, bytes: Buffer) {
  const provider = process.env.PHOTO_STORAGE || 'postgres';
  if (provider === 'postgres') return { contenido: new Uint8Array(bytes), objectKey: null };
  if (provider !== 'r2') throw new ApiError(503, 'El almacenamiento de fotografías no está configurado.');
  let storage: ReturnType<typeof createR2Storage> | undefined;
  try {
    storage = createR2Storage();
    const objectKey = photoObjectKey(workId, stage, photoId, hash);
    await storage.put(objectKey, bytes, hash);
    return { contenido: null, objectKey };
  } catch { throw new ApiError(503, 'No se pudo guardar la foto. Intenta nuevamente en unos momentos.'); }
  finally { storage?.close(); }
}

export async function readPhoto(photo: { contenido: Uint8Array | null; objectKey: string | null; sha256: string }): Promise<Buffer> {
  // Legacy photos remain accessible while the verified migration is pending.
  if (photo.contenido) return Buffer.from(photo.contenido);
  let storage: ReturnType<typeof createR2Storage> | undefined;
  try {
    if (!photo.objectKey) throw new Error('Missing photo content');
    storage = createR2Storage();
    return await storage.get(photo.objectKey, photo.sha256);
  } catch { throw new ApiError(503, 'No se pudo cargar la foto. Intenta nuevamente en unos momentos.'); }
  finally { storage?.close(); }
}

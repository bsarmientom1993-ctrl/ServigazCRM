const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { createHash } = require('node:crypto');

const MAX_PHOTO_BYTES = 786432;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function photoObjectKey(workId, stage, photoId, hash) {
  const uuid = /^[a-f0-9-]{36}$/i;
  if (!uuid.test(workId) || !uuid.test(photoId) || !['INICIAL', 'FINAL'].includes(stage) || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid photo identity');
  return `trabajos/${workId}/${stage.toLowerCase()}/${photoId}-${hash}.jpg`;
}
function createR2Storage(env = process.env) {
  const account = env.R2_ACCOUNT_ID || '', bucket = env.R2_BUCKET_NAME || '';
  if (!/^[a-f0-9]{32}$/i.test(account) || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) throw new Error('R2 configuration missing or invalid');
  const client = new S3Client({
    region: 'auto', endpoint: `https://${account}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    maxAttempts: 2,
    requestHandler: { connectionTimeout: 3000, requestTimeout: 12000 },
    requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
  });
  function validateKey(key) {
    if (!/^trabajos\/[a-f0-9-]{36}\/(inicial|final)\/[a-f0-9-]{36}-[a-f0-9]{64}\.jpg$/i.test(key) && !/^tienda\/[a-f0-9-]{36}\/[a-f0-9]{64}\.jpg$/i.test(key)) throw new Error('Invalid R2 photo key');
  }
  return {
    async put(key, bytes, hash) {
      validateKey(key);
      if (!bytes.length || bytes.length > MAX_PHOTO_BYTES || digest(bytes) !== hash) throw new Error('Invalid photo content');
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: 'image/jpeg', CacheControl: 'private, no-store', Metadata: { sha256: hash } }), { abortSignal: AbortSignal.timeout(15000) });
    },
    async get(key, hash) {
      validateKey(key);
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: AbortSignal.timeout(15000) });
      if (!result.Body) throw new Error('Missing R2 photo');
      const chunks = []; let size = 0;
      try {
        if (result.ContentLength > MAX_PHOTO_BYTES) throw new Error('R2 photo exceeds limit');
        for await (const chunk of result.Body) {
          size += chunk.length;
          if (size > MAX_PHOTO_BYTES) throw new Error('R2 photo exceeds limit');
          chunks.push(Buffer.from(chunk));
        }
        const bytes = Buffer.concat(chunks);
        if (!bytes.length || digest(bytes) !== hash) throw new Error('R2 photo integrity mismatch');
        return bytes;
      } finally { result.Body.destroy?.(); }
    },
    close() { client.destroy(); },
  };
}
module.exports = { createR2Storage, photoObjectKey, digest, MAX_PHOTO_BYTES };

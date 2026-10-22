const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createR2Storage, photoObjectKey, digest } = require('../scripts/lib/photo-r2.cjs');
const { S3Client } = require('@aws-sdk/client-s3');
const { Readable } = require('node:stream');
const env = { R2_ACCOUNT_ID: 'a'.repeat(32), R2_BUCKET_NAME: 'servigaz-test', R2_ACCESS_KEY_ID: 'test', R2_SECRET_ACCESS_KEY: 'test' };
const work = '11111111-1111-4111-8111-111111111111', photo = '22222222-2222-4222-8222-222222222222';

test('R2 rejects incomplete credentials and photo keys outside the work namespace', () => {
  assert.throws(() => createR2Storage({}), /configuration/);
  assert.throws(() => createR2Storage({ ...env, R2_ACCOUNT_ID: 'http://localhost' }), /configuration/);
  assert.throws(() => photoObjectKey('../secret', 'INICIAL', photo, 'a'.repeat(64)), /identity/);
  assert.match(photoObjectKey(work, 'FINAL', photo, 'a'.repeat(64)), /^trabajos\/.+\/final\//);
});

test('R2 bounds and verifies downloaded bytes instead of trusting the object metadata', async () => {
  const original = S3Client.prototype.send;
  const bytes = Buffer.from('jpeg content'), hash = digest(bytes), key = photoObjectKey(work, 'INICIAL', photo, hash);
  let response = { Body: Readable.from([bytes]), ContentLength: bytes.length };
  S3Client.prototype.send = async () => response;
  const storage = createR2Storage(env);
  try {
    assert.deepEqual(await storage.get(key, hash), bytes);
    response = { Body: Readable.from([Buffer.from('corrupt')]), ContentLength: 7 };
    await assert.rejects(storage.get(key, hash), /integrity/);
    response = { Body: Readable.from([Buffer.alloc(786433)]) };
    await assert.rejects(storage.get(key, hash), /limit/);
    await assert.rejects(storage.put(key, bytes, 'a'.repeat(64)), /content/);
    await assert.rejects(storage.get('outside/private-file', hash), /key/);
  } finally { storage.close(); S3Client.prototype.send = original; }
});

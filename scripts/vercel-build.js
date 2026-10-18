const { execSync } = require('child_process');

console.log('🚀 Iniciando script de construcción para Servigaz CRM...');

// Detectar URL de base de datos de producción
const candidates = [
  process.env.DATABASE_URL,
  process.env.POSTGRES_PRISMA_URL,
  process.env.STORAGE_PRISMA_URL,
  process.env.STORAGE_URL,
  process.env.NEON_DATABASE_URL,
  process.env.NEON_PRISMA_URL,
  process.env.POSTGRES_URL,
];

// Elegir la primera URL válida que no sea localhost si estamos en Vercel
let targetUrl = candidates.find((url) => url && typeof url === 'string' && (url.startsWith('postgres://') || url.startsWith('postgresql://')));

if (process.env.VERCEL === '1') {
  // En Vercel, buscar específicamente una remota
  const remoteUrl = candidates.find(
    (url) => url && !url.includes('localhost') && (url.startsWith('postgres://') || url.startsWith('postgresql://'))
  );
  if (remoteUrl) targetUrl = remoteUrl;
}

if (targetUrl) {
  process.env.DATABASE_URL = targetUrl;
  console.log('🔗 URL de base de datos detectada y configurada.');

  if (process.env.VERCEL === '1' || process.env.AUTO_MIGRATE === '1') {
    try {
      console.log('📦 Sincronizando esquema de base de datos (prisma db push)...');
      execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', env: process.env });

      console.log('🌱 Creando usuarios y configuración inicial (seed)...');
      execSync('node prisma/seed.js', { stdio: 'inherit', env: process.env });
      console.log('✅ Base de datos inicializada correctamente.');
    } catch (err) {
      console.warn('⚠️ Nota sobre sincronización de BD:', err.message);
    }
  }
} else {
  console.log('ℹ️ No se detectó URL remota de base de datos. Saltando auto-migración.');
}

console.log('⚙️ Generando cliente Prisma y construyendo Next.js...');
execSync('npx prisma generate', { stdio: 'inherit', env: process.env });
execSync('next build', { stdio: 'inherit', env: process.env });
console.log('🎉 Construcción completada exitosamente.');

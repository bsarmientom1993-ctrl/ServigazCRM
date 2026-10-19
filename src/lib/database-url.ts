const keys = ["DATABASE_URL", "POSTGRES_PRISMA_URL", "STORAGE_PRISMA_URL", "NEON_DATABASE_URL",
  "NEON_PRISMA_URL", "POSTGRES_URL", "POSTGRES_URL_NON_POOLING", "DATABASE_URL_UNPOOLED", "STORAGE_URL"] as const;

export function resolveDatabaseUrl(env: Record<string, string | undefined>): string | undefined {
  const urls = keys.map(key => env[key]?.trim()).filter((value): value is string =>
    Boolean(value && /^(postgresql|postgres|prisma|prisma\+postgres):\/\//i.test(value)));
  if (env.VERCEL === "1") {
    return urls.find(value => {
      try { return !["localhost", "127.0.0.1", "[::1]", "::1"].includes(new URL(value).hostname.toLowerCase()); }
      catch { return false; }
    });
  }
  return urls[0];
}


type LoginStage = "ACCOUNT_LOOKUP" | "PASSWORD_CHECK" | "TOKEN_SIGNING" | "AUDIT" | "REQUEST";
export function loginFailure(error: unknown, stage: LoginStage) {
  const failure = error as { code?: unknown; errorCode?: unknown; message?: unknown };
  const candidate = String(failure?.code || failure?.errorCode || "");
  const message = typeof failure?.message === "string" ? failure.message : "";
  let code = /^P\d{4}$/.test(candidate) ? candidate : "AUTH_INTERNAL_ERROR";
  // Prisma initialization failures often have neither code nor errorCode.
  // Classify only known patterns; never return raw messages or connection URLs.
  if (code === "AUTH_INTERNAL_ERROR") {
    if (/Environment variable not found:\s*DATABASE_URL/i.test(message)) code = "DATABASE_URL_MISSING";
    else if (/the URL must start|invalid (connection string|port)|URL scheme/i.test(message)) code = "DATABASE_URL_INVALID";
    else if (/Authentication failed|password authentication failed/i.test(message)) code = "P1000";
    else if (/Can't reach database server/i.test(message)) code = "P1001";
    else if (/TLS|certificate/i.test(message)) code = "P1011";
    else if (/could not locate.*Query Engine|Query Engine.*not found|did not initialize yet/i.test(message)) code = "DATABASE_ENGINE_UNAVAILABLE";
  }
  const messages: Record<string, string> = {
    DATABASE_URL_MISSING: "Falta configurar la conexión de producción a la base de datos en Vercel. Contacta al administrador.",
    DATABASE_URL_INVALID: "La conexión de la base de datos tiene un formato inválido. Contacta al administrador.",
    DATABASE_ENGINE_UNAVAILABLE: "El servidor necesita regenerar su conexión de datos. Contacta al administrador.",
    P1000: "El servidor no puede autenticarse en la base de datos. El administrador debe revisar su conexión.",
    P1001: "La base de datos no está disponible. Intenta nuevamente en unos momentos.",
    P1002: "La base de datos tardó demasiado en responder. Intenta nuevamente.",
    P1003: "La base de datos configurada no existe. Contacta al administrador.",
    P1010: "El servidor no tiene permiso para acceder a la base de datos. Contacta al administrador.",
    P1011: "No se pudo establecer una conexión segura con la base de datos. Contacta al administrador.",
    P1012: "La conexión de la base de datos no está configurada correctamente. Contacta al administrador.",
    P1017: "La conexión con la base de datos se interrumpió. Intenta nuevamente.",
    P2021: "La base de datos necesita una actualización antes de iniciar sesión. Contacta al administrador.",
    P2022: "La base de datos necesita una actualización antes de iniciar sesión. Contacta al administrador.",
    P2024: "La base de datos está ocupada. Intenta nuevamente en unos momentos.",
  };
  return { error: messages[code] || "No se pudo iniciar sesión. Contacta al administrador.", code, stage };
}


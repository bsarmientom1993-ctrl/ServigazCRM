CREATE TABLE IF NOT EXISTS "CuentaProfesional" (
 "id" TEXT PRIMARY KEY,"email" TEXT NOT NULL UNIQUE,"passwordHash" TEXT NOT NULL,"nombre" TEXT NOT NULL,"empresa" TEXT NOT NULL,"identificacionEmpresa" TEXT NOT NULL,"telefono" TEXT NOT NULL,"direccion" TEXT NOT NULL,
 "estado" TEXT NOT NULL DEFAULT 'PENDIENTE_DOCUMENTOS' CHECK ("estado" IN ('PENDIENTE_DOCUMENTOS','EN_REVISION','APROBADA','RECHAZADA','SUSPENDIDA')),
 "descuentoPct" DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK ("descuentoPct">=0 AND "descuentoPct"<100),
 "clienteId" TEXT UNIQUE REFERENCES "Cliente"("id") ON DELETE RESTRICT,"sucursalId" TEXT REFERENCES "Sucursal"("id") ON DELETE RESTRICT,
 "revisionNota" TEXT NOT NULL DEFAULT '',"aprobadaPorNombre" TEXT,"aprobadaAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "DocumentoProfesional" (
 "id" TEXT PRIMARY KEY,"cuentaId" TEXT NOT NULL REFERENCES "CuentaProfesional"("id") ON DELETE RESTRICT,"tipo" TEXT NOT NULL,"nombre" TEXT NOT NULL,"mediaType" TEXT NOT NULL,"sha256" TEXT NOT NULL,
 "contenido" BYTEA,"objectKey" TEXT,"verificadoAt" TIMESTAMP(3),"verificadoPorNombre" TEXT,"observacion" TEXT NOT NULL DEFAULT '',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("cuentaId","tipo","sha256"),CHECK ("contenido" IS NOT NULL OR "objectKey" IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS "DocumentoProfesional_cuentaId_createdAt_idx" ON "DocumentoProfesional"("cuentaId","createdAt");
CREATE TABLE IF NOT EXISTS "ConfiguracionProfesionales" ("id" TEXT PRIMARY KEY,"documentosRequeridos" JSONB NOT NULL,"modificadoPorNombre" TEXT NOT NULL,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "PedidoProfesional" (
 "id" TEXT PRIMARY KEY,"numero" SERIAL UNIQUE,"cuentaId" TEXT NOT NULL REFERENCES "CuentaProfesional"("id") ON DELETE RESTRICT,
 "tipo" TEXT NOT NULL CHECK ("tipo" IN ('PRODUCTOS','SERVICIO')),"subtipoCodigo" TEXT,"detalle" TEXT NOT NULL,"items" JSONB NOT NULL,"total" DECIMAL(12,2),"descuentoPct" DECIMAL(5,2) NOT NULL,
 "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',"trabajoId" TEXT UNIQUE REFERENCES "Trabajo"("id") ON DELETE RESTRICT,"solicitudHash" TEXT NOT NULL,"notaGestion" TEXT NOT NULL DEFAULT '',"respuestaCliente" JSONB,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PedidoProfesional_cuentaId_createdAt_idx" ON "PedidoProfesional"("cuentaId","createdAt");
CREATE TABLE IF NOT EXISTS "AccesoProfesionalRate" ("clave" TEXT PRIMARY KEY,"intentos" INTEGER NOT NULL DEFAULT 1,"venceAt" TIMESTAMP(3) NOT NULL);
CREATE TABLE IF NOT EXISTS "Notificacion" (
 "id" TEXT PRIMARY KEY,"destinatario" TEXT NOT NULL,"clave" TEXT NOT NULL,"tipo" TEXT NOT NULL,"titulo" TEXT NOT NULL,"mensaje" TEXT NOT NULL,"ruta" TEXT NOT NULL,
 "leidaAt" TIMESTAMP(3),"pushEstado" TEXT NOT NULL DEFAULT 'PENDIENTE',"pushIntentos" INTEGER NOT NULL DEFAULT 0,"pushClaimAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE("destinatario","clave")
);
CREATE INDEX IF NOT EXISTS "Notificacion_destinatario_createdAt_idx" ON "Notificacion"("destinatario","createdAt");
CREATE INDEX IF NOT EXISTS "Notificacion_pushEstado_createdAt_idx" ON "Notificacion"("pushEstado","createdAt");
CREATE TABLE IF NOT EXISTS "DispositivoPush" (
 "id" TEXT PRIMARY KEY,"destinatario" TEXT NOT NULL,"endpoint" TEXT NOT NULL UNIQUE,"p256dh" TEXT NOT NULL,"auth" TEXT NOT NULL,"nombre" TEXT NOT NULL,"activa" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "DispositivoPush_destinatario_activa_idx" ON "DispositivoPush"("destinatario","activa");

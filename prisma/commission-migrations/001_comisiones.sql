CREATE TABLE IF NOT EXISTS "ConfiguracionComision" (
 "usuarioId" TEXT PRIMARY KEY REFERENCES "Usuario"("id") ON DELETE RESTRICT,
 "porcentaje" DECIMAL(5,2) NOT NULL CHECK ("porcentaje" >= 0 AND "porcentaje" <= 100),
 "activa" BOOLEAN NOT NULL DEFAULT false,
 "modificadoPorId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT,
 "modificadoPorNombre" TEXT NOT NULL,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "ComisionTrabajo" (
 "id" TEXT PRIMARY KEY,"trabajoId" TEXT NOT NULL UNIQUE REFERENCES "Trabajo"("id") ON DELETE RESTRICT,
 "codigoTrabajo" TEXT NOT NULL,"servicio" TEXT NOT NULL,
 "beneficiarioId" TEXT REFERENCES "Usuario"("id") ON DELETE RESTRICT,"beneficiarioNombre" TEXT NOT NULL,
 "utilidadBase" DECIMAL(12,2) NOT NULL,"porcentaje" DECIMAL(5,2) NOT NULL CHECK ("porcentaje" >= 0 AND "porcentaje" <= 100),
 "monto" DECIMAL(12,2) NOT NULL CHECK ("monto" >= 0),
 "estado" TEXT NOT NULL CHECK ("estado" IN ('PENDIENTE','APROBADA','PAGADA','ANULADA','NO_GENERADA')),
 "motivo" TEXT NOT NULL,"generadaPorNombre" TEXT NOT NULL,
 "aprobadaAt" TIMESTAMP(3),"aprobadaPorId" TEXT,"aprobadaPorNombre" TEXT,
 "pagadaAt" TIMESTAMP(3),"pagadaPorId" TEXT,"pagadaPorNombre" TEXT,"medioPago" TEXT,"referenciaPago" TEXT,"pagoHuella" TEXT,
 "egresoId" TEXT UNIQUE REFERENCES "EgresoGeneralManual"("id") ON DELETE RESTRICT,
 "anuladaAt" TIMESTAMP(3),"anuladaPorNombre" TEXT,"motivoAnulacion" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ComisionTrabajo_beneficiarioId_estado_createdAt_idx" ON "ComisionTrabajo" ("beneficiarioId","estado","createdAt");

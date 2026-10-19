CREATE TABLE IF NOT EXISTS "UbicacionInventario" (
  "id" TEXT PRIMARY KEY, "nombre" TEXT NOT NULL, "tipo" TEXT NOT NULL CHECK ("tipo" IN ('ALMACEN','TIENDA')),
  "sucursalId" TEXT REFERENCES "Sucursal"("id") ON DELETE RESTRICT,
  "direccion" TEXT, "activo" BOOLEAN NOT NULL DEFAULT true, "esInicial" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tienda_sucursal" CHECK ("tipo" <> 'TIENDA' OR "sucursalId" IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS "UbicacionInventario_sucursalId_activo_idx" ON "UbicacionInventario"("sucursalId","activo");
CREATE TABLE IF NOT EXISTS "ExistenciaInventario" (
  "id" TEXT PRIMARY KEY, "productoId" TEXT NOT NULL REFERENCES "ProductoInventario"("id") ON DELETE RESTRICT,
  "ubicacionId" TEXT NOT NULL REFERENCES "UbicacionInventario"("id") ON DELETE RESTRICT,
  "stockActual" DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK ("stockActual" >= 0),
  "stockMinimo" DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK ("stockMinimo" >= 0),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExistenciaInventario_productoId_ubicacionId_key" ON "ExistenciaInventario"("productoId","ubicacionId");
CREATE INDEX IF NOT EXISTS "ExistenciaInventario_ubicacionId_idx" ON "ExistenciaInventario"("ubicacionId");
CREATE TABLE IF NOT EXISTS "TraspasoInventario" (
  "id" TEXT PRIMARY KEY, "productoId" TEXT NOT NULL REFERENCES "ProductoInventario"("id") ON DELETE RESTRICT,
  "origenId" TEXT NOT NULL REFERENCES "UbicacionInventario"("id") ON DELETE RESTRICT,
  "destinoId" TEXT NOT NULL REFERENCES "UbicacionInventario"("id") ON DELETE RESTRICT,
  "cantidad" DECIMAL(10,2) NOT NULL CHECK ("cantidad" > 0), "costoUnitario" DECIMAL(12,2) NOT NULL CHECK ("costoUnitario" >= 0),
  "estado" TEXT NOT NULL DEFAULT 'EN_TRANSITO' CHECK ("estado" IN ('EN_TRANSITO','RECIBIDO','CANCELADO')),
  "enviadoPorId" TEXT NOT NULL REFERENCES "Usuario"("id"), "resueltoPorId" TEXT REFERENCES "Usuario"("id"),
  "observaciones" TEXT, "motivoCancelacion" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "resueltoAt" TIMESTAMP(3),
  CONSTRAINT "traspaso_ubicaciones_diferentes" CHECK ("origenId" <> "destinoId")
);
CREATE INDEX IF NOT EXISTS "TraspasoInventario_origenId_estado_idx" ON "TraspasoInventario"("origenId","estado");
CREATE INDEX IF NOT EXISTS "TraspasoInventario_destinoId_estado_idx" ON "TraspasoInventario"("destinoId","estado");
ALTER TABLE "MovimientoInventario" ADD COLUMN IF NOT EXISTS "ubicacionOrigenId" TEXT REFERENCES "UbicacionInventario"("id");
ALTER TABLE "MovimientoInventario" ADD COLUMN IF NOT EXISTS "ubicacionDestinoId" TEXT REFERENCES "UbicacionInventario"("id");
ALTER TABLE "MovimientoInventario" ADD COLUMN IF NOT EXISTS "traspasoId" TEXT REFERENCES "TraspasoInventario"("id");
ALTER TABLE "MovimientoInventario" ADD COLUMN IF NOT EXISTS "evento" TEXT;
ALTER TABLE "MovimientoInventario" ADD COLUMN IF NOT EXISTS "costoUnitario" DECIMAL(12,2);
ALTER TABLE "MovimientoInventario" ADD COLUMN IF NOT EXISTS "huellaOperacion" TEXT;
LOCK TABLE "ProductoInventario" IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO "UbicacionInventario" ("id","nombre","tipo","esInicial")
VALUES ('inventario-inicial','Inventario previo · por distribuir','ALMACEN',true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ExistenciaInventario" ("id","productoId","ubicacionId","stockActual","stockMinimo")
SELECT 'inicial:' || "id", "id", 'inventario-inicial', "stockActual", 0 FROM "ProductoInventario"
ON CONFLICT ("productoId","ubicacionId") DO NOTHING;

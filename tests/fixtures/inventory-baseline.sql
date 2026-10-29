-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'ENCARGADO', 'TECNICO_FIJO');

-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "NivelFidelizacion" AS ENUM ('NUEVO', 'REGULAR', 'FRECUENTE', 'VIP');

-- CreateEnum
CREATE TYPE "TipoFlujo" AS ENUM ('COMPLETO', 'SIMPLIFICADO', 'PROYECTO', 'LIBRE');

-- CreateEnum
CREATE TYPE "EstadoTrabajo" AS ENUM ('BORRADOR', 'EVALUACION_PENDIENTE', 'EVALUADO', 'COTIZADO', 'COTIZACION_VENCIDA', 'EN_NEGOCIACION', 'APROBADO', 'PAGO_A_CUENTA_RECIBIDO', 'PAGO_A_CUENTA_VENCIDO', 'RECHAZADO', 'ANTICIPO_RECIBIDO', 'EN_PROCESO', 'EN_PAUSA', 'CANCELADO', 'TERMINADO_TECNICO', 'VALIDADO', 'FINALIZADO_FINANCIERO', 'ARCHIVADO', 'RECLAMO_GARANTIA');

-- CreateEnum
CREATE TYPE "TipoVersionCotizacion" AS ENUM ('ORIGINAL', 'CORRECCION', 'NEGOCIACION', 'REACTIVACION');

-- CreateEnum
CREATE TYPE "EstadoCotizacion" AS ENUM ('VIGENTE', 'VENCIDA', 'APROBADA', 'RECHAZADA', 'SUPERADA');

-- CreateEnum
CREATE TYPE "TipoPago" AS ENUM ('ANTICIPO', 'PAGO_A_CUENTA', 'SALDO_FINAL', 'PAGO_TOTAL');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'QR', 'TARJETA', 'CHEQUE', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoOrigenMaterial" AS ENUM ('INVENTARIO', 'MANUAL_FUERA_INVENTARIO');

-- CreateEnum
CREATE TYPE "EstadoAsistencia" AS ENUM ('PRESENTE', 'TARDE', 'TARDE_GRAVE', 'FALTA', 'INCOMPLETO');

-- CreateEnum
CREATE TYPE "EstadoPermiso" AS ENUM ('SOLICITADO', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "CategoriaEgreso" AS ENUM ('NOMINA', 'ALQUILER', 'SERVICIOS', 'INVENTARIO_COMPRAS', 'TRANSPORTE', 'MANTENIMIENTO', 'OTROS');

-- CreateEnum
CREATE TYPE "TipoMovimientoInventario" AS ENUM ('COMPRA', 'CONSUMO_TRABAJO', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'TRASPASO');

-- CreateEnum
CREATE TYPE "EstadoReclamo" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'RESUELTO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "AccionAuditoria" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'INTENTO_INVALIDO', 'BLOQUEO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "telefono" TEXT,
    "rol" "RolUsuario" NOT NULL,
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'ACTIVO',
    "sucursalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstaladorEventual" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "especialidad" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstaladorEventual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sucursal" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sucursal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nombreCompleto" TEXT NOT NULL,
    "telefonos" JSONB NOT NULL,
    "email" TEXT,
    "direccion" TEXT NOT NULL,
    "ubicacionMapsUrl" TEXT,
    "sucursalId" TEXT,
    "nivelFidelizacion" "NivelFidelizacion" NOT NULL DEFAULT 'NUEVO',
    "descuentoVipPct" DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistorialFidelizacion" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nivelAnterior" "NivelFidelizacion" NOT NULL,
    "nivelNuevo" "NivelFidelizacion" NOT NULL,
    "motivo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialFidelizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionPrecio" (
    "id" TEXT NOT NULL,
    "subtipoCodigo" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "diametro" TEXT,
    "material" TEXT,
    "precioUnitario" DECIMAL(12,2) NOT NULL,
    "unidad" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "modificadoPor" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfiguracionPrecio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionManoObra" (
    "id" TEXT NOT NULL,
    "subtipoCodigo" TEXT NOT NULL,
    "tipoCalculo" TEXT NOT NULL,
    "tarifaBase" DECIMAL(12,2) NOT NULL,
    "factorDificultad" DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "modificadoPor" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfiguracionManoObra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionDificultad" (
    "id" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL,
    "factorMultiplicador" DECIMAL(4,2) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "sugerenciaInstaladorExtra" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "modificadoPor" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionDificultad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionGarantia" (
    "id" TEXT NOT NULL,
    "subtipoCodigo" TEXT NOT NULL,
    "mesesDefecto" INTEGER NOT NULL,
    "condiciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "modificadoPor" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionGarantia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionAnticipo" (
    "id" TEXT NOT NULL,
    "subtipoCodigo" TEXT NOT NULL,
    "porcentajeMinimo" DECIMAL(5,2) NOT NULL DEFAULT 50.0,
    "diasVencimiento" INTEGER NOT NULL DEFAULT 5,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "modificadoPor" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionAnticipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionDescuento" (
    "id" TEXT NOT NULL,
    "topeMaximoPct" DECIMAL(5,2) NOT NULL DEFAULT 20.0,
    "pctMaxEncargado" DECIMAL(5,2) NOT NULL DEFAULT 10.0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "modificadoPor" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionDescuento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionPersonal" (
    "id" TEXT NOT NULL,
    "horaEntrada" TEXT NOT NULL DEFAULT '08:30',
    "horaSalida" TEXT NOT NULL DEFAULT '18:00',
    "toleranciaMinutos" INTEGER NOT NULL DEFAULT 15,
    "descuentoFaltaPct" DECIMAL(5,2) NOT NULL DEFAULT 100.0,
    "descuentoTardanzaPct" DECIMAL(5,2) NOT NULL DEFAULT 25.0,
    "maxPermisosMes" INTEGER NOT NULL DEFAULT 2,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "modificadoPor" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionPersonal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogoCategoria" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "icono" TEXT NOT NULL DEFAULT 'Flame',
    "color" TEXT NOT NULL DEFAULT 'orange',
    "requiereVisita" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogoCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogoSubtipo" (
    "id" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogoSubtipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionGeneral" (
    "id" TEXT NOT NULL,
    "monedaBase" TEXT NOT NULL DEFAULT 'CLP',
    "margenMinimoPct" DECIMAL(5,2) NOT NULL DEFAULT 25.0,
    "alertaBajoMargenUmbralPct" DECIMAL(5,2) NOT NULL DEFAULT 20.0,
    "slaGarantiaHorasAlerta" INTEGER NOT NULL DEFAULT 24,
    "slaGarantiaHorasLimite" INTEGER NOT NULL DEFAULT 168,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "modificadoPor" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionGeneral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trabajo" (
    "id" TEXT NOT NULL,
    "codigoCorrelativo" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "sucursalId" TEXT,
    "encargadoId" TEXT NOT NULL,
    "tecnicoId" TEXT,
    "tipoFlujo" "TipoFlujo" NOT NULL,
    "subtipoCodigo" TEXT NOT NULL,
    "subtipoNombre" TEXT NOT NULL,
    "estado" "EstadoTrabajo" NOT NULL DEFAULT 'BORRADOR',
    "dificultadNivel" INTEGER DEFAULT 1,
    "requiereInstaladorExtra" BOOLEAN NOT NULL DEFAULT false,
    "porcentajeAvance" INTEGER NOT NULL DEFAULT 0,
    "motivoPausa" TEXT,
    "observaciones" TEXT,
    "checklistLibre" JSONB,
    "fechasSla" JSONB,
    "fechaInicioEjecucion" TIMESTAMP(3),
    "fechaFinEjecucion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitaTecnica" (
    "id" TEXT NOT NULL,
    "trabajoId" TEXT NOT NULL,
    "tecnicoId" TEXT NOT NULL,
    "fechaProgramada" TIMESTAMP(3) NOT NULL,
    "fechaEjecutada" TIMESTAMP(3),
    "medidasJson" JSONB,
    "condicionesJson" JSONB,
    "ventilacionVasaOk" BOOLEAN,
    "fotosUrls" JSONB,
    "dificultadSugerida" INTEGER NOT NULL DEFAULT 1,
    "observaciones" TEXT,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitaTecnica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cotizacion" (
    "id" TEXT NOT NULL,
    "trabajoId" TEXT NOT NULL,
    "numeroVersion" INTEGER NOT NULL DEFAULT 1,
    "tipoVersion" "TipoVersionCotizacion" NOT NULL DEFAULT 'ORIGINAL',
    "datosFormularioJson" JSONB NOT NULL,
    "snapshotCalculoJson" JSONB NOT NULL,
    "subtotalMateriales" DECIMAL(12,2) NOT NULL,
    "subtotalManoObra" DECIMAL(12,2) NOT NULL,
    "montoTransporte" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "montoAlquilerHerram" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "porcentajeDescuento" DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    "montoDescuento" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "descuentoAprobadoPor" TEXT,
    "totalCotizado" DECIMAL(12,2) NOT NULL,
    "anticipoMinimoRequerido" DECIMAL(12,2) NOT NULL,
    "alertaBajoMargen" BOOLEAN NOT NULL DEFAULT false,
    "justificacionMargenBajo" TEXT,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoCotizacion" NOT NULL DEFAULT 'VIGENTE',
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "trabajoId" TEXT NOT NULL,
    "tipoPago" "TipoPago" NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL DEFAULT 'TRANSFERENCIA',
    "comprobanteUrl" TEXT,
    "numeroReferencia" TEXT,
    "registradoPorId" TEXT NOT NULL,
    "fechaPago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reciboPdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialEjecucion" (
    "id" TEXT NOT NULL,
    "trabajoId" TEXT NOT NULL,
    "tipoOrigen" "TipoOrigenMaterial" NOT NULL DEFAULT 'INVENTARIO',
    "productoId" TEXT,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL,
    "costoUnitario" DECIMAL(12,2) NOT NULL,
    "subtotalCosto" DECIMAL(12,2) NOT NULL,
    "proveedorNombre" TEXT,
    "proveedorContacto" TEXT,
    "consumido" BOOLEAN NOT NULL DEFAULT true,
    "recuperable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialEjecucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EgresoTrabajo" (
    "id" TEXT NOT NULL,
    "trabajoId" TEXT NOT NULL,
    "materialesInventarioJson" JSONB NOT NULL,
    "materialesManualesJson" JSONB NOT NULL,
    "manoObraMonto" DECIMAL(12,2) NOT NULL,
    "transporteMonto" DECIMAL(12,2) NOT NULL,
    "totalEgreso" DECIMAL(12,2) NOT NULL,
    "totalIngreso" DECIMAL(12,2) NOT NULL,
    "utilidadNeta" DECIMAL(12,2) NOT NULL,
    "alertaMargenNegativo" BOOLEAN NOT NULL DEFAULT false,
    "bloqueado" BOOLEAN NOT NULL DEFAULT true,
    "generadoPor" TEXT NOT NULL DEFAULT 'SISTEMA_FASE_13',
    "fechaGeneracion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EgresoTrabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificadoGarantia" (
    "id" TEXT NOT NULL,
    "trabajoId" TEXT NOT NULL,
    "codigoCertificado" TEXT NOT NULL,
    "mesesCobertura" INTEGER NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "qrCodeData" TEXT NOT NULL,
    "etiquetasCantidad" INTEGER NOT NULL DEFAULT 1,
    "pdfUrl" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificadoGarantia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReclamoGarantia" (
    "id" TEXT NOT NULL,
    "trabajoOriginalId" TEXT NOT NULL,
    "trabajoDerivadoId" TEXT,
    "descripcionFalla" TEXT NOT NULL,
    "tecnicoAsignadoId" TEXT,
    "fechaReclamo" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "slaLimiteFecha" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoReclamo" NOT NULL DEFAULT 'PENDIENTE',
    "solucionDetalle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReclamoGarantia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsistenciaPersonal" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "horaEntrada" TIMESTAMP(3),
    "horaSalida" TIMESTAMP(3),
    "estado" "EstadoAsistencia" NOT NULL DEFAULT 'PRESENTE',
    "descuentoAplicadoMonto" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "anuladoPorAdmin" BOOLEAN NOT NULL DEFAULT false,
    "motivoAnulacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AsistenciaPersonal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermisoPersonal" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "fechaSolicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaPermiso" DATE NOT NULL,
    "motivo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "comprobanteUrl" TEXT NOT NULL,
    "estado" "EstadoPermiso" NOT NULL DEFAULT 'SOLICITADO',
    "aprobadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermisoPersonal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EgresoGeneralManual" (
    "id" TEXT NOT NULL,
    "categoria" "CategoriaEgreso" NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "proveedorInfo" TEXT,
    "comprobanteUrl" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "esRecurrente" BOOLEAN NOT NULL DEFAULT false,
    "fechaEgreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EgresoGeneralManual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoInventario" (
    "id" TEXT NOT NULL,
    "codigoSku" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "unidadMedida" TEXT NOT NULL,
    "stockActual" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "stockMinimo" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "costoPromedio" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "precioVenta" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductoInventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoInventario" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "tipoMovimiento" "TipoMovimientoInventario" NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL,
    "stockAnterior" DECIMAL(10,2) NOT NULL,
    "stockNuevo" DECIMAL(10,2) NOT NULL,
    "origenSucursalId" TEXT,
    "destinoSucursalId" TEXT,
    "autoConfirmado" BOOLEAN NOT NULL DEFAULT false,
    "usuarioId" TEXT NOT NULL,
    "proveedorNombre" TEXT,
    "proveedorContacto" TEXT,
    "observaciones" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoInventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditoriaLog" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "modulo" TEXT NOT NULL,
    "accion" "AccionAuditoria" NOT NULL,
    "entidadTipo" TEXT NOT NULL,
    "entidadId" TEXT,
    "valoresAnteriores" JSONB,
    "valoresNuevos" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditoriaLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_rol_estado_idx" ON "Usuario"("rol", "estado");

-- CreateIndex
CREATE INDEX "Cliente_nombreCompleto_idx" ON "Cliente"("nombreCompleto");

-- CreateIndex
CREATE INDEX "ConfiguracionPrecio_subtipoCodigo_concepto_activo_idx" ON "ConfiguracionPrecio"("subtipoCodigo", "concepto", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracionDificultad_nivel_key" ON "ConfiguracionDificultad"("nivel");

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracionGarantia_subtipoCodigo_key" ON "ConfiguracionGarantia"("subtipoCodigo");

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracionAnticipo_subtipoCodigo_key" ON "ConfiguracionAnticipo"("subtipoCodigo");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogoCategoria_codigo_key" ON "CatalogoCategoria"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogoSubtipo_codigo_key" ON "CatalogoSubtipo"("codigo");

-- CreateIndex
CREATE INDEX "CatalogoSubtipo_categoriaId_activo_idx" ON "CatalogoSubtipo"("categoriaId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "Trabajo_codigoCorrelativo_key" ON "Trabajo"("codigoCorrelativo");

-- CreateIndex
CREATE INDEX "Trabajo_clienteId_estado_tipoFlujo_idx" ON "Trabajo"("clienteId", "estado", "tipoFlujo");

-- CreateIndex
CREATE INDEX "Trabajo_encargadoId_tecnicoId_idx" ON "Trabajo"("encargadoId", "tecnicoId");

-- CreateIndex
CREATE INDEX "VisitaTecnica_trabajoId_tecnicoId_idx" ON "VisitaTecnica"("trabajoId", "tecnicoId");

-- CreateIndex
CREATE INDEX "Cotizacion_trabajoId_estado_idx" ON "Cotizacion"("trabajoId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "Cotizacion_trabajoId_numeroVersion_key" ON "Cotizacion"("trabajoId", "numeroVersion");

-- CreateIndex
CREATE INDEX "Pago_trabajoId_tipoPago_idx" ON "Pago"("trabajoId", "tipoPago");

-- CreateIndex
CREATE INDEX "MaterialEjecucion_trabajoId_tipoOrigen_idx" ON "MaterialEjecucion"("trabajoId", "tipoOrigen");

-- CreateIndex
CREATE UNIQUE INDEX "EgresoTrabajo_trabajoId_key" ON "EgresoTrabajo"("trabajoId");

-- CreateIndex
CREATE INDEX "EgresoTrabajo_trabajoId_idx" ON "EgresoTrabajo"("trabajoId");

-- CreateIndex
CREATE UNIQUE INDEX "CertificadoGarantia_trabajoId_key" ON "CertificadoGarantia"("trabajoId");

-- CreateIndex
CREATE UNIQUE INDEX "CertificadoGarantia_codigoCertificado_key" ON "CertificadoGarantia"("codigoCertificado");

-- CreateIndex
CREATE UNIQUE INDEX "ReclamoGarantia_trabajoDerivadoId_key" ON "ReclamoGarantia"("trabajoDerivadoId");

-- CreateIndex
CREATE INDEX "ReclamoGarantia_trabajoOriginalId_estado_idx" ON "ReclamoGarantia"("trabajoOriginalId", "estado");

-- CreateIndex
CREATE INDEX "AsistenciaPersonal_fecha_estado_idx" ON "AsistenciaPersonal"("fecha", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "AsistenciaPersonal_usuarioId_fecha_key" ON "AsistenciaPersonal"("usuarioId", "fecha");

-- CreateIndex
CREATE INDEX "PermisoPersonal_usuarioId_estado_idx" ON "PermisoPersonal"("usuarioId", "estado");

-- CreateIndex
CREATE INDEX "EgresoGeneralManual_categoria_fechaEgreso_idx" ON "EgresoGeneralManual"("categoria", "fechaEgreso");

-- CreateIndex
CREATE INDEX "EgresoGeneralManual_creadoPorId_idx" ON "EgresoGeneralManual"("creadoPorId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductoInventario_codigoSku_key" ON "ProductoInventario"("codigoSku");

-- CreateIndex
CREATE INDEX "ProductoInventario_codigoSku_categoria_activo_idx" ON "ProductoInventario"("codigoSku", "categoria", "activo");

-- CreateIndex
CREATE INDEX "MovimientoInventario_productoId_tipoMovimiento_fecha_idx" ON "MovimientoInventario"("productoId", "tipoMovimiento", "fecha");

-- CreateIndex
CREATE INDEX "AuditoriaLog_modulo_accion_timestamp_idx" ON "AuditoriaLog"("modulo", "accion", "timestamp");

-- CreateIndex
CREATE INDEX "AuditoriaLog_usuarioId_idx" ON "AuditoriaLog"("usuarioId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialFidelizacion" ADD CONSTRAINT "HistorialFidelizacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogoSubtipo" ADD CONSTRAINT "CatalogoSubtipo_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CatalogoCategoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trabajo" ADD CONSTRAINT "Trabajo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trabajo" ADD CONSTRAINT "Trabajo_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trabajo" ADD CONSTRAINT "Trabajo_encargadoId_fkey" FOREIGN KEY ("encargadoId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trabajo" ADD CONSTRAINT "Trabajo_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitaTecnica" ADD CONSTRAINT "VisitaTecnica_trabajoId_fkey" FOREIGN KEY ("trabajoId") REFERENCES "Trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitaTecnica" ADD CONSTRAINT "VisitaTecnica_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_trabajoId_fkey" FOREIGN KEY ("trabajoId") REFERENCES "Trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_trabajoId_fkey" FOREIGN KEY ("trabajoId") REFERENCES "Trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialEjecucion" ADD CONSTRAINT "MaterialEjecucion_trabajoId_fkey" FOREIGN KEY ("trabajoId") REFERENCES "Trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialEjecucion" ADD CONSTRAINT "MaterialEjecucion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "ProductoInventario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EgresoTrabajo" ADD CONSTRAINT "EgresoTrabajo_trabajoId_fkey" FOREIGN KEY ("trabajoId") REFERENCES "Trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificadoGarantia" ADD CONSTRAINT "CertificadoGarantia_trabajoId_fkey" FOREIGN KEY ("trabajoId") REFERENCES "Trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReclamoGarantia" ADD CONSTRAINT "ReclamoGarantia_trabajoOriginalId_fkey" FOREIGN KEY ("trabajoOriginalId") REFERENCES "Trabajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReclamoGarantia" ADD CONSTRAINT "ReclamoGarantia_trabajoDerivadoId_fkey" FOREIGN KEY ("trabajoDerivadoId") REFERENCES "Trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReclamoGarantia" ADD CONSTRAINT "ReclamoGarantia_tecnicoAsignadoId_fkey" FOREIGN KEY ("tecnicoAsignadoId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsistenciaPersonal" ADD CONSTRAINT "AsistenciaPersonal_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermisoPersonal" ADD CONSTRAINT "PermisoPersonal_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermisoPersonal" ADD CONSTRAINT "PermisoPersonal_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EgresoGeneralManual" ADD CONSTRAINT "EgresoGeneralManual_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "ProductoInventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_origenSucursalId_fkey" FOREIGN KEY ("origenSucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_destinoSucursalId_fkey" FOREIGN KEY ("destinoSucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditoriaLog" ADD CONSTRAINT "AuditoriaLog_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FormatoCotizacion" ("id" TEXT PRIMARY KEY, "formato" JSONB NOT NULL, "modificadoPor" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
ALTER TABLE "Usuario" ADD COLUMN "rolesAsignados" JSONB;

const catalogoInicial = require("./catalogo-inicial.json");
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const dbUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.STORAGE_PRISMA_URL ||
  process.env.STORAGE_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.NEON_PRISMA_URL ||
  process.env.POSTGRES_URL;

const prisma = new PrismaClient({
  datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
});

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    throw new Error("El seed de demostración no puede ejecutarse en producción.");
  }

  // Explicit development seed: catalog reads never initialize database state.
  for (const category of catalogoInicial) {
    const { subtipos, ...fields } = category;
    const saved = await prisma.catalogoCategoria.upsert({ where: { codigo: fields.codigo }, update: {}, create: fields });
    for (const [index, subtype] of subtipos.entries()) {
      await prisma.catalogoSubtipo.upsert({ where: { codigo: subtype.codigo }, update: {},
        create: { ...subtype, categoriaId: saved.id, orden: index + 1 } });
    }
  }
  console.log('🌱 Iniciando Seed de Servigaz CRM v12.0...');

  // 1. Sucursal Principal
  const sucursalCentral = await prisma.sucursal.upsert({
    where: { id: 'sucursal-central-01' },
    update: {},
    create: {
      id: 'sucursal-central-01',
      nombre: 'Sucursal Central & Taller Servigaz',
      direccion: 'Av. Ballivián #450, Calacoto, La Paz',
      telefono: '+591 2 2784512',
      activo: true,
    },
  });

  // 2. Usuarios del Sistema
  const passwordHash = await bcrypt.hash('Admin123!', 10);
  const passwordTechHash = await bcrypt.hash('Tecnico123!', 10);

  const adminUser = await prisma.usuario.upsert({
    where: { email: 'admin@servigaz.cl' },
    update: { passwordHash, estado: 'ACTIVO' },
    create: {
      nombre: 'Administrador General',
      email: 'admin@servigaz.cl',
      passwordHash,
      telefono: '+591 71523411',
      rol: 'ADMIN',
      estado: 'ACTIVO',
      sucursalId: sucursalCentral.id,
    },
  });

  await prisma.usuario.upsert({
    where: { email: 'encargado@servigaz.cl' },
    update: { passwordHash, estado: 'ACTIVO' },
    create: {
      nombre: 'Carlos Encargado Operaciones',
      email: 'encargado@servigaz.cl',
      passwordHash,
      telefono: '+591 72098452',
      rol: 'ENCARGADO',
      estado: 'ACTIVO',
      sucursalId: sucursalCentral.id,
    },
  });

  await prisma.usuario.upsert({
    where: { email: 'tecnico@servigaz.cl' },
    update: { passwordHash: passwordTechHash, estado: 'ACTIVO' },
    create: {
      nombre: 'Pedro Instalador Fijo',
      email: 'tecnico@servigaz.cl',
      passwordHash: passwordTechHash,
      telefono: '+591 77234901',
      rol: 'TECNICO_FIJO',
      estado: 'ACTIVO',
      sucursalId: sucursalCentral.id,
    },
  });

  // 3. Catálogo de Instaladores Eventuales
  await prisma.instaladorEventual.createMany({
    data: [
      {
        nombre: 'Mario Soto (Eventual)',
        telefono: '+591 78451230',
        especialidad: 'Soldadura y Cañerías Gas',
        activo: true,
        notas: 'Tarifa diaria convenida por trabajo',
      },
      {
        nombre: 'Juan Valdés (Eventual)',
        telefono: '+591 68124578',
        especialidad: 'Montaje de Radiadores y Calderas',
        activo: true,
        notas: 'Disponibilidad fines de semana',
      },
    ],
    skipDuplicates: true,
  });

  // 4. Configuración General (Fase 0)
  await prisma.configuracionGeneral.upsert({
    where: { id: 'config-general-01' },
    update: { monedaBase: 'BOB' },
    create: {
      id: 'config-general-01',
      monedaBase: 'BOB',
      margenMinimoPct: 25.0,
      alertaBajoMargenUmbralPct: 20.0,
      slaGarantiaHorasAlerta: 24,
      slaGarantiaHorasLimite: 168,
      activo: true,
      modificadoPor: adminUser.id,
    },
  });

  // 4.2 Dificultad
  const dificultades = [
    { nivel: 1, factorMultiplicador: 1.0, descripcion: 'Baja: Fácil acceso, trazado lineal despejado', extra: false },
    { nivel: 2, factorMultiplicador: 1.1, descripcion: 'Media-Baja: Acceso estándar con curvas menores', extra: false },
    { nivel: 3, factorMultiplicador: 1.2, descripcion: 'Media: Pasadas de losa o muros estándar', extra: false },
    { nivel: 4, factorMultiplicador: 1.4, descripcion: 'Alta: Alturas o trabajo en espacios confinados (Requiere 2 instaladores)', extra: true },
    { nivel: 5, factorMultiplicador: 1.6, descripcion: 'Compleja: Muros de hormigón armado, accesos de alto riesgo', extra: true },
  ];

  for (const dif of dificultades) {
    await prisma.configuracionDificultad.upsert({
      where: { nivel: dif.nivel },
      update: {},
      create: {
        nivel: dif.nivel,
        factorMultiplicador: dif.factorMultiplicador,
        descripcion: dif.descripcion,
        sugerenciaInstaladorExtra: dif.extra,
        activo: true,
        modificadoPor: adminUser.id,
      },
    });
  }

  // 4.3 Garantias
  const garantiasDefecto = [
    { subtipoCodigo: '1.1.1', meses: 12, condiciones: 'Garantía legal y técnica por instalación nueva de gas' },
    { subtipoCodigo: '1.1.2', meses: 12, condiciones: 'Garantía por modificación de red de gas' },
    { subtipoCodigo: '1.1.3', meses: 12, condiciones: 'Garantía por ampliación de red de gas' },
    { subtipoCodigo: '1.2.1', meses: 12, condiciones: 'Garantía red calefacción central' },
    { subtipoCodigo: '1.2.2', meses: 12, condiciones: 'Garantía instalación radiadores' },
    { subtipoCodigo: '1.2.3', meses: 12, condiciones: 'Garantía piso radiante' },
    { subtipoCodigo: '1.3.1', meses: 12, condiciones: 'Garantía plomería e instalaciones sanitarias' },
    { subtipoCodigo: '3.2',   meses: 12, condiciones: 'Equipo Nuevo: Garantía de fábrica (12 meses)' },
    { subtipoCodigo: '3.3',   meses: 3,  condiciones: 'Revisión técnica y diagnóstico de calefón/caldera' },
    { subtipoCodigo: '3.4',   meses: 6,  condiciones: 'Mantenimiento preventivo / correctivo de equipo' },
    { subtipoCodigo: '3.5',   meses: 12, condiciones: 'Remplazo de equipo nuevo' },
    { subtipoCodigo: '3.6',   meses: 3,  condiciones: 'Reglaje y calibración de combustión' },
  ];

  for (const g of garantiasDefecto) {
    await prisma.configuracionGarantia.upsert({
      where: { subtipoCodigo: g.subtipoCodigo },
      update: {},
      create: {
        subtipoCodigo: g.subtipoCodigo,
        mesesDefecto: g.meses,
        condiciones: g.condiciones,
        activo: true,
        modificadoPor: adminUser.id,
      },
    });
  }

  // 4.4 Precios
  const preciosBolivianos = [
    { subtipoCodigo: '1.1.1', concepto: 'Tubo Cobre 1/2 Visto', precioUnitario: 85, unidad: 'metro', diametro: '1/2"', material: 'COBRE' },
    { subtipoCodigo: '1.1.1', concepto: 'Tubo Cobre 3/4 Visto', precioUnitario: 110, unidad: 'metro', diametro: '3/4"', material: 'COBRE' },
    { subtipoCodigo: '1.1.1', concepto: 'Tubo Cobre 1/2 Empotrado', precioUnitario: 125, unidad: 'metro', diametro: '1/2"', material: 'COBRE' },
    { subtipoCodigo: '1.1.1', concepto: 'Gabinete de Medidor Gas', precioUnitario: 350, unidad: 'unidad', diametro: 'Estándar', material: 'ACERO' },
    { subtipoCodigo: '1.1.1', concepto: 'Proyecto y Planos SEC/YPFB', precioUnitario: 650, unidad: 'proyecto', diametro: 'N/A', material: 'SERVICIO' },
    { subtipoCodigo: '1.2.1', concepto: 'Tubería Calefacción PPR 20mm', precioUnitario: 65, unidad: 'metro', diametro: '20mm', material: 'PPR' },
    { subtipoCodigo: '1.2.2', concepto: 'Radiador de Aluminio 600mm', precioUnitario: 450, unidad: 'unidad', diametro: 'N/A', material: 'ALUMINIO' },
    { subtipoCodigo: '1.2.3', concepto: 'Piso Radiante Trazado Completo', precioUnitario: 220, unidad: 'm2', diametro: '16mm', material: 'PEX' },
    { subtipoCodigo: '1.3.1', concepto: 'Punto de Agua Fría / Caliente PPR', precioUnitario: 180, unidad: 'unidad', diametro: '1/2"', material: 'PPR' },
    { subtipoCodigo: '3.2',   concepto: 'Caldera Mural Mixta 24kW', precioUnitario: 4800, unidad: 'unidad', diametro: '24kW', material: 'EQUIPO' },
    { subtipoCodigo: '3.2',   concepto: 'Calefón Tiro Forzado 14L', precioUnitario: 2200, unidad: 'unidad', diametro: '14L', material: 'EQUIPO' },
    { subtipoCodigo: '3.3',   concepto: 'Revisión Técnica y Diagnóstico de Calefón / Caldera', precioUnitario: 180, unidad: 'servicio', diametro: 'N/A', material: 'SERVICIO' },
    { subtipoCodigo: '3.4',   concepto: 'Mantenimiento Preventivo / Correctivo de Calefón', precioUnitario: 260, unidad: 'servicio', diametro: 'N/A', material: 'SERVICIO' },
    { subtipoCodigo: '3.6',   concepto: 'Reglaje y Calibración de Combustión', precioUnitario: 150, unidad: 'servicio', diametro: 'N/A', material: 'SERVICIO' },
    { subtipoCodigo: 'OTROS', concepto: 'Prueba de Hermeticidad Manométrica', precioUnitario: 280, unidad: 'proyecto', diametro: 'N/A', material: 'SERVICIO' },
    { subtipoCodigo: 'OTROS', concepto: 'Cambio / Reemplazo de Medidor', precioUnitario: 320, unidad: 'unidad', diametro: 'Estándar', material: 'SERVICIO' },
    { subtipoCodigo: 'OTROS', concepto: 'Alquiler de Termofusora / Herramienta', precioUnitario: 120, unidad: 'dia', diametro: 'N/A', material: 'ARRIENDO' },
  ];

  await prisma.configuracionPrecio.deleteMany();
  for (const p of preciosBolivianos) {
    await prisma.configuracionPrecio.create({
      data: {
        ...p,
        activo: true,
        modificadoPor: adminUser.id,
      },
    });
  }

  // 4.5 Mano de obra
  const manoObraBolivianos = [
    { subtipoCodigo: '1.1.1', tipoCalculo: 'por_metro', tarifaBase: 45, factorDificultad: 1.0, modificadoPor: adminUser.id },
    { subtipoCodigo: '1.1.2', tipoCalculo: 'por_metro', tarifaBase: 50, factorDificultad: 1.0, modificadoPor: adminUser.id },
    { subtipoCodigo: '1.2.1', tipoCalculo: 'por_metro', tarifaBase: 40, factorDificultad: 1.0, modificadoPor: adminUser.id },
    { subtipoCodigo: '1.2.3', tipoCalculo: 'por_metro', tarifaBase: 60, factorDificultad: 1.0, modificadoPor: adminUser.id },
    { subtipoCodigo: '1.3.1', tipoCalculo: 'por_trabajo', tarifaBase: 150, factorDificultad: 1.0, modificadoPor: adminUser.id },
    { subtipoCodigo: '3.2',   tipoCalculo: 'por_trabajo', tarifaBase: 450, factorDificultad: 1.0, modificadoPor: adminUser.id },
    { subtipoCodigo: '3.3',   tipoCalculo: 'por_trabajo', tarifaBase: 180, factorDificultad: 1.0, modificadoPor: adminUser.id },
    { subtipoCodigo: '3.4',   tipoCalculo: 'por_trabajo', tarifaBase: 260, factorDificultad: 1.0, modificadoPor: adminUser.id },
    { subtipoCodigo: '3.6',   tipoCalculo: 'por_trabajo', tarifaBase: 150, factorDificultad: 1.0, modificadoPor: adminUser.id },
    { subtipoCodigo: 'OTROS', tipoCalculo: 'por_trabajo', tarifaBase: 200, factorDificultad: 1.0, modificadoPor: adminUser.id },
  ];

  await prisma.configuracionManoObra.deleteMany();
  for (const mo of manoObraBolivianos) {
    await prisma.configuracionManoObra.create({ data: mo });
  }

  // 5. Inventario
  await prisma.productoInventario.createMany({
    data: [
      {
        codigoSku: 'TUB-CU-12',
        nombre: 'Tubo de Cobre Tipo L 1/2" (Tira 6m)',
        categoria: 'Tubos Gas',
        unidadMedida: 'tira',
        stockActual: 30,
        stockMinimo: 10,
        costoPromedio: 140,
        precioVenta: 195,
        activo: true,
      },
      {
        codigoSku: 'VALV-GAS-12',
        nombre: 'Válvula de Paso Gas 1/2" Certificada',
        categoria: 'Válvulas',
        unidadMedida: 'unidad',
        stockActual: 50,
        stockMinimo: 15,
        costoPromedio: 35,
        precioVenta: 55,
        activo: true,
      },
      {
        codigoSku: 'CALD-MURAL-24',
        nombre: 'Caldera Mural Mixta 24kW Gas Natural',
        categoria: 'Calderas',
        unidadMedida: 'unidad',
        stockActual: 4,
        stockMinimo: 2,
        costoPromedio: 3800,
        precioVenta: 4800,
        activo: true,
      },
      {
        codigoSku: 'REP-TERMOCUPLA',
        nombre: 'Termocupla Universal para Calefón',
        categoria: 'Repuestos Calefón',
        unidadMedida: 'unidad',
        stockActual: 25,
        stockMinimo: 5,
        costoPromedio: 40,
        precioVenta: 75,
        activo: true,
      },
      {
        codigoSku: 'REP-MEMBRANA',
        nombre: 'Membrana de Goma para Calefón de Paso',
        categoria: 'Repuestos Calefón',
        unidadMedida: 'unidad',
        stockActual: 40,
        stockMinimo: 10,
        costoPromedio: 15,
        precioVenta: 35,
        activo: true,
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Seed completado con éxito en Bolivianos (Bs.).');
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

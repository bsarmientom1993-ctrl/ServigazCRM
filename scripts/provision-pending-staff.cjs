const { PrismaClient } = require('@prisma/client');
const { databaseUrl } = require('./migrate-inventory.cjs');
const accounts = require('./pending-staff-accounts.json');

async function provisionPendingStaff(client) {
  return client.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(742390)`;
    let created = 0;
    for (const account of accounts) {
      // Never overwrite an existing person's password, profile or permissions.
      if (await tx.usuario.findUnique({ where: { email: account.email } })) continue;
      const user = await tx.usuario.create({ data: {
        ...account, rol: 'TECNICO_FIJO', rolesAsignados: [], estado: 'INACTIVO', sucursalId: null,
      } });
      await tx.auditoriaLog.create({ data: {
        modulo: 'USUARIOS', accion: 'CREATE', entidadTipo: 'Usuario', entidadId: user.id,
        valoresNuevos: { nombre: user.nombre, email: user.email, roles: [], estado: 'INACTIVO', origen: 'Alta de personal solicitada por administrador' },
      } });
      created++;
    }
    const users = await tx.usuario.findMany({ where: { email: { in: accounts.map(a => a.email) } }, select: { email: true } });
    if (users.length !== accounts.length) throw new Error('No se pudieron verificar las seis cuentas.');
    return { created, verified: users.length };
  }, { timeout: 30000 });
}
module.exports = { provisionPendingStaff };
if (require.main === module && process.env.VERCEL_ENV === 'production') {
  const url = databaseUrl(process.env);
  if (!url) throw new Error('No hay conexión PostgreSQL para registrar el personal.');
  const client = new PrismaClient({ datasources: { db: { url } } });
  provisionPendingStaff(client)
    .then(({ created, verified }) => console.log(`Personal: ${created} cuentas creadas; ${verified} cuentas verificadas. Cuentas existentes conservadas.`))
    .catch(error => { console.error('No se pudo registrar el personal:', error.code || error.name); process.exitCode = 1; })
    .finally(() => client.$disconnect());
}

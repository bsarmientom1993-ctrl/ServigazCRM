# Nuevo trabajo y coordinación de técnicos

El asistente conserva tres pasos visibles para todas las modalidades:

1. **Cliente:** buscar una ficha existente o registrar nombre, teléfono, dirección y correo opcional. Añadir indicaciones de acceso y el día/intervalo preferido por el cliente.
2. **Servicio:** seleccionar categorías del catálogo (gas, plomería, calefacción, otros, etc.) y el trabajo específico de cada categoría. Se admiten varias categorías y subtipos con guiones bajos en su código.
3. **Coordinación y confirmación:** consultar las agendas de todos los técnicos activos de la sucursal (el administrador consulta todos), comparar sus espacios y elegir un técnico y horario antes de crear el trabajo.

La agenda utiliza la jornada configurada en Personal, las visitas pendientes y los permisos aprobados. La duración de la visita y el margen de traslado son estimaciones editables para esta coordinación; inicialmente se proponen 60 y 30 minutos. Las visitas antiguas sin duración registrada usan esos valores. La disponibilidad refleja lo registrado en el sistema; el encargado debe confirmar las estimaciones y el horario con el cliente.

El horario se envía con su zona horaria y se vuelve a validar al guardar. Las reservas bloquean al técnico dentro de la transacción, tanto en el asistente como al agendar desde la ficha de un trabajo, para evitar solapamientos concurrentes. Los permisos se consideran por día completo. Las visitas completadas y los trabajos cancelados, rechazados, archivados o cerrados no bloquean espacios futuros.

Si aún no se puede coordinar, el trabajo puede guardarse pendiente, sin asignar técnico ni horario ocultos. Un servicio con evaluación queda en borrador; un servicio directo queda listo para preparar su cotización. Crear el trabajo no emite automáticamente una cotización ni registra un pago.

Los detalles del cliente y su preferencia quedan visibles en la ficha del trabajo. Los borradores del asistente se guardan por usuario, se contrastan con clientes, técnicos y catálogo actuales al restaurar y se eliminan al guardar con éxito. Un identificador estable permite reintentar sin duplicar cliente, trabajo ni reserva.

No se requiere migración adicional: la programación usa los campos JSON ya existentes de trabajo y visita, y el registro de auditoría conserva la huella de cada solicitud.

## Verificación

- `npm test`: validaciones de cliente, restauración de borradores, categorías, zonas horarias y conflictos de duración/traslado, además del flujo existente.
- `TEST_DATABASE_URL` debe apuntar a PostgreSQL local con nombre terminado en `_test`; `npm run test:wizard` crea un esquema temporal propio y verifica creación, permisos, preferencias, agenda, concurrencia, reintentos y programación desde la ficha.
- `npm run build`: comprueba la compilación de producción.

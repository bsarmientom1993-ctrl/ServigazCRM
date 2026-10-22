# Seguimiento diario de proyectos de gas

Encargados y administradores disponen de Proyectos y de un expediente por instalación. La lista respeta el ámbito de sucursal y distingue pendientes, presentados, entregados y proyectos sin gestión registrada hoy, usando la fecha de Bolivia. La fecha objetivo es estimada; la aprobación de la entidad no se da por realizada al terminar la instalación.

Cada gestión registra tipo, fecha, autor, entidad, referencia, detalle, documentos y próximo seguimiento. Se puede permanecer en la misma etapa durante la espera, registrar varias gestiones diarias y conservar observaciones recibidas y correcciones enviadas por separado. Las entradas se añaden al historial, sin operaciones de modificación o borrado. Las solicitudes repetidas con la misma clave no duplican una gestión. Los cambios de etapa se validan con las transiciones existentes.

El historial exclusivo del proyecto utiliza registros ProyectoGas y recupera los registros anteriores de PROYECTO_GAS asociados al trabajo. Excluye la revisión técnica y los importes de cotización. La paginación permite consultar todos los antecedentes. La supervisión de la medición conserva su sección propia. Los movimientos nuevos de proyecto no aparecen como operaciones generales del trabajo.

Un seguimiento no reemplaza las observaciones generales ni la documentación de gestiones anteriores, no cambia la cotización y no finaliza la instalación. La inclusión del proyecto se define en el alcance antes de la aceptación o los cobros. Las instalaciones menores configuradas sin proyecto no aparecen en el tablero y no requieren entrega de un expediente. Si el proyecto está incluido, se exige estado ENTREGADO para permitir el cierre final, además de pago conciliado y calidad aprobada.

Pruebas: npm test, npm run test:gas y npm run test:agenda. Las integraciones requieren TEST_DATABASE_URL local terminada en _test y utilizan esquemas temporales aislados.

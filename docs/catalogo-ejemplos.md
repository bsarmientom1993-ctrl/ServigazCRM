# Catálogo inicial de servicios

Se incorporan quince servicios editables, agrupados en Gas, Calefacción, Plomería, Otros servicios, Mantenimiento de equipos, Equipos sin instalación y Equipos con instalación. Los ejemplos son entradas del catálogo real para seleccionar en Nuevo trabajo. No generan trabajos, clientes, pagos, stock ni usuarios, y no establecen precios ni reglas comerciales.

## Aplicación

El despliegue en Vercel ejecuta `scripts/configure-example-catalog.cjs` después de la actualización aditiva de inventario. La configuración se aplica por versiones y se registra en auditoría como `catalogo-ejemplos-v1` (catálogo original) y `catalogo-ejemplos-v2` (calefones y provisión). La actualización v2 añade solo sus tres servicios: no repone entradas originales eliminadas. No se ejecuta el seed general ni se modifican credenciales.

El proceso añade solo categorías y códigos que no existan. Conserva nombres, descripciones, necesidad de visita y precios personalizados. No reactiva categorías o servicios desactivados ni mueve un código que ya esté asignado a otra categoría. Los próximos despliegues no reponen entradas quitadas después de la configuración inicial.

En **Precios y tarifas → Catálogo**, el administrador puede usar **Añadir ejemplos que falten** para completar expresamente los códigos ausentes. Las entradas existentes y desactivadas se conservan. La operación se audita y usa una transacción y un bloqueo para evitar duplicados en solicitudes simultáneas.

Las categorías Gas, Calefacción y Plomería nuevas requieren evaluación. Otros servicios nuevos permite cotización directa. Si esas categorías ya existían, se conserva su configuración actual.

En local, `npm run catalogo:ejemplos` aplica la misma configuración de una sola vez sobre la conexión configurada.

## Pruebas

Con `TEST_DATABASE_URL` apuntando a PostgreSQL local terminado en `_test`, `npm run test:catalog` crea un esquema temporal y verifica: catálogo vacío, repetición, personalizaciones, desactivaciones, colisiones de códigos, concurrencia, rollback, permisos y creación de un trabajo con un servicio añadido. No admite bases remotas.


## Calefones y provisión

- Mantenimiento de equipos → Mantenimiento de calefones: cotización directa por defecto; registrar marca, modelo y tareas solicitadas.
- Equipos sin instalación → Provisión de equipos sin instalación: cotización directa; detallar marca, modelo, cantidad, accesorios y entrega, excluyendo instalación.
- Equipos con instalación → Provisión de equipos con instalación: visita de evaluación previa; revisar ubicación, conexiones, materiales y alcance.

El administrador puede editar nombres y necesidad de visita por categoría. No se fijan importes comerciales. Estos servicios no se clasifican como instalación de red de gas por defecto, por lo que no exigen metros de red ni visto bueno por metro.

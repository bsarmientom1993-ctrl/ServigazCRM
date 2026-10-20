# Catálogo inicial de servicios

Se incorporan doce servicios editables, agrupados en Gas, Calefacción, Plomería y Otros servicios. Los ejemplos son entradas del catálogo real para seleccionar en Nuevo trabajo. No generan trabajos, clientes, pagos, stock ni usuarios, y no establecen precios ni reglas comerciales.

## Aplicación

El despliegue en Vercel ejecuta `scripts/configure-example-catalog.cjs` después de la actualización aditiva de inventario. La configuración se aplica una sola vez y se registra en auditoría como `catalogo-ejemplos-v1`. No se ejecuta el seed general ni se modifican credenciales.

El proceso añade solo categorías y códigos que no existan. Conserva nombres, descripciones, necesidad de visita y precios personalizados. No reactiva categorías o servicios desactivados ni mueve un código que ya esté asignado a otra categoría. Los próximos despliegues no reponen entradas quitadas después de la configuración inicial.

En **Precios y tarifas → Catálogo**, el administrador puede usar **Añadir ejemplos que falten** para completar expresamente los códigos ausentes. Las entradas existentes y desactivadas se conservan. La operación se audita y usa una transacción y un bloqueo para evitar duplicados en solicitudes simultáneas.

Las categorías Gas, Calefacción y Plomería nuevas requieren evaluación. Otros servicios nuevos permite cotización directa. Si esas categorías ya existían, se conserva su configuración actual.

En local, `npm run catalogo:ejemplos` aplica la misma configuración de una sola vez sobre la conexión configurada.

## Pruebas

Con `TEST_DATABASE_URL` apuntando a PostgreSQL local terminado en `_test`, `npm run test:catalog` crea un esquema temporal y verifica: catálogo vacío, repetición, personalizaciones, desactivaciones, colisiones de códigos, concurrencia, rollback, permisos y creación de un trabajo con un servicio añadido. No admite bases remotas.

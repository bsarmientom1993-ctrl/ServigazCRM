# Almacenes, tiendas y sucursales

## Puesta en marcha

1. Como administrador abre **Sucursales y ubicaciones**. Crea las sucursales con sus nombres, direcciones y teléfonos. Cada sucursal se crea junto con su tienda y su saldo de materiales.
2. Crea un almacén tipo **Almacén** y elige **Central · compartido**. Puedes añadir más almacenes centrales o asociados a una sucursal.
3. Si necesitas más ubicaciones, crea almacenes o tiendas adicionales y selecciona su sucursal. Los nombres y direcciones se configuran en la aplicación, sin cambiar código.
   Para sucursales existentes sin tienda, crea una ubicación tipo Tienda y asígnala a la sucursal.
4. Asigna a los encargados y técnicos existentes a su sucursal.
5. En **Almacenes y tiendas**, selecciona **Inventario previo · por distribuir**. Envía sus existencias mediante traspasos a las ubicaciones físicas correspondientes y confirma su recepción.

## Operación diaria

- Las compras requieren una ubicación de recepción. Actualizan su saldo y el costo promedio ponderado de toda la empresa; opcionalmente registran el egreso en la misma transacción.
- El envío descuenta el disponible del origen. La cantidad permanece en tránsito hasta que el destino confirma la recepción. El total de la empresa incluye el tránsito.
- El administrador o el encargado de la sucursal de destino puede recibir. El origen puede cancelar un envío pendiente indicando un motivo y confirmando que el material está de vuelta. Un envío recibido no se puede cancelar.
- Los materiales usados en trabajos requieren una ubicación de salida. El servidor determina su costo y evita stock negativo.
- Los mínimos y alertas se configuran por producto y ubicación. El historial conserva compras, envíos, recepciones y consumos.
- Los encargados solo consultan saldos de su sucursal. Pueden consultar nombres de destinos para enviar productos. Los almacenes centrales los gestiona el administrador.
- Puedes editar nombres y direcciones o desactivar ubicaciones vacías sin traspasos pendientes. Para desactivar una sucursal primero reasigna su personal y desactiva sus ubicaciones. Los registros históricos se conservan.

## Actualización de la base de datos

El build en Vercel ejecuta `scripts/migrate-inventory.cjs` antes de compilar. La migración `001_ubicaciones.sql` es aditiva: crea tablas y columnas, copia las existencias actuales a una ubicación inicial y registra su aplicación. No borra tablas, reinicia datos ni ejecuta seeds. Una transacción y un bloqueo de migración permiten repetir el build con seguridad.

En un entorno local ya inicializado, usa `npm run db:inventory`. Se utiliza la misma resolución de conexión que la aplicación, incluyendo los alias PostgreSQL de producción. Conserva la política de respaldos de tu base. Un desacuerdo entre el total previo y las ubicaciones bloquea movimientos para exigir conciliación.

## Verificación

`npm test` verifica permisos y el flujo del cliente; `npm run typecheck` verifica TypeScript; `npm run build` compila.

Para pruebas reales de inventario establece `TEST_DATABASE_URL` a un PostgreSQL local cuyo nombre termine en `_test` y ejecuta `npm run test:inventory`. Las pruebas crean y eliminan exclusivamente un esquema temporal propio. Comprueban conservación del inventario anterior, concurrencia, reintentos, compras con egresos, permisos, privacidad, cancelaciones, consumos y rollback.

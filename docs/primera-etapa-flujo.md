# Primera etapa: integridad del recorrido

Cambios implementados sobre `6e95dfeca8dc9388ac3381a4fc254251a2ed512f`.
La validación local no utiliza la base de producción. Antes de operar datos históricos deben revisarse las condiciones de compatibilidad descritas abajo.

## Comportamiento implementado

- Sesión obligatoria y usuario activo consultado en la base. Roles reales comprobados antes de operar; se retiró la atribución automática de acciones a un administrador.
- Trabajos restringidos por técnico asignado o ámbito del encargado. Listado, detalle y resumen del dashboard aplican ese ámbito. Clientes, técnicos y garantías tienen controles de acceso.
- Inicialización pública deshabilitada, selector de credenciales demo retirado y secreto JWT configurado de al menos 32 caracteres.
- Toda mutación de la orden bloquea su fila durante la transacción. Pagos, auditoría, cambios de estado y cierre no se guardan por separado.
- Cobro con clave UUID de idempotencia: el cliente la conserva durante reintentos y se utiliza como ID del pago. Reutilizarla con datos distintos se rechaza. No requiere cambiar el esquema.
- Pagos parciales y totales cubren correctamente el anticipo. La aceptación del cliente se mantiene separada: un cobro previo no la sustituye.
- No se cobran importes mayores al saldo ni se reciben nuevos cobros ordinarios cuando el saldo ya es cero.
- La decisión se vincula explícitamente a la versión visible de la cotización. Rechazar conserva RECHAZADO; no aumenta el contador de trabajos completados.
- La cotización manual recalcula totales, descuento y anticipo en servidor y valida límites de descuento por rol. Sustituir una versión marca la anterior como SUPERADA; una orden con cobros o aceptación no permite reemplazo silencioso.
- El inicio requiere aceptación de la versión vigente, técnico activo y anticipo completo. Solo encargado/administrador valida calidad.
- Visitas requieren mediciones y evidencia; se eliminaron las fotos y conformidades inventadas. El término técnico registra fotos y observaciones en auditoría y las muestra al encargado.
- El consumo de materiales toma el costo del inventario en servidor y aplica un descuento condicionado al stock suficiente dentro de una transacción.
- Las compras bloquean el producto al calcular stock y costo promedio. Movimiento, compra y egreso opcional se guardan juntos.
- El cierre exige VALIDADO, cotización aceptada y pagos exactamente conciliados. Costos reales se ingresan expresamente; se consulta la garantía configurada por servicio.
- La consulta pública de garantía devuelve datos del certificado y servicio, sin exponer datos del cliente ni registros completos de usuarios.
- La ficha muestra el próximo paso, importe pagado y saldo; muestra rechazos del servidor y bloquea botones durante el envío.
- El build dejó de ejecutar sincronizaciones destructivas o seeds contra la base.

## Validación

Comandos:
```sh
npm ci
npm run typecheck
npm test
npm run build
```

31 pruebas de regresión con el ejecutor de Node. Cubren políticas monetarias, cobros, reintentos, sesión/roles, aceptación, cierre, evidencia, permisos de los handlers y consumo condicionado de inventario.

Las pruebas de rutas sustituyen Prisma por dobles controlados. No demuestran concurrencia, bloqueos ni rollback en un PostgreSQL real. Es necesario verificar estos puntos en un entorno de prueba antes de desplegar. No se inició Docker ni se obtuvo una base local disponible. El build puede ejecutarse sin credenciales de producción y no escribe en la base.

## Configuración y compatibilidad

1. Configurar JWT_SECRET con un valor privado de al menos 32 caracteres. Si se utilizaba la clave de respaldo anterior, será necesario iniciar sesión de nuevo.
2. Rotar las contraseñas demo existentes antes de uso operativo. Retirar el selector no modifica esas cuentas. El seed sigue siendo exclusivamente de desarrollo y ahora rechaza NODE_ENV=production y VERCEL=1.
3. Revisar asignación de encargado, técnico y sucursal en registros anteriores. Las órdenes históricas creadas sin sucursal no se reasignan automáticamente; el administrador conserva acceso.
4. Las órdenes antiguas APROBADO/VALIDADO pueden tener cotizaciones VIGENTE porque la versión anterior no registraba APROBADA. Deben conciliarse contra la aceptación real antes de habilitar inicio/cierre. No se deduce la aceptación a partir del estado antiguo o de un pago.
5. Revisar pagos duplicados/sobrepagos y cierres anteriores incompletos. No se corrigen saldos históricos automáticamente. Un cierre con egreso sin garantía devuelve conflicto para revisión, en lugar de aparentar éxito.
6. Configurar garantía activa para cada código de servicio que vaya a cerrarse. Los servicios combinados necesitan una política/configuración para el código combinado; no se les inventa una duración común.
7. El catálogo existente define si requiere visita. Los servicios directos pasan a preparación de presupuesto (EVALUADO), sin una tarifa automática de Bs. 180. El encargado revisa y emite el presupuesto.
8. La programación usa una fecha ISO con zona explícita. La pantalla convierte la hora local del navegador antes de enviarla.
9. Las fotos se registran mediante enlaces HTTP/HTTPS. La carga directa de archivos a almacenamiento sigue pendiente; los enlaces deben corresponder a evidencia propia y tener permisos adecuados.
10. El enlace de validación del certificado abre la API pública del mismo dominio. La vista pública del certificado para clientes y la generación gráfica del QR/PDF quedan para la siguiente etapa.
11. No hay migración del esquema en esta entrega. El build tampoco inicializa bases vacías ni ejecuta el seed. Para cambios futuros del esquema, incorporar migraciones revisadas.
12. Las integraciones que registran pagos deben enviar Idempotency-Key con UUID y mantenerlo en reintentos. La decisión requiere cotizacionId.
13. El balance consolidado queda reservado al administrador para no revelar egresos privados de otros usuarios. Los encargados conservan acceso a sus egresos mediante la API correspondiente.
14. La vigencia conserva 15 días corridos. La política de días hábiles y calendario debe acordarse antes de la siguiente etapa.

## Verificación pendiente en PostgreSQL de pruebas

- Recorrer una instalación y un servicio directo con aceptación, cobro, ejecución, evidencia, calidad y cierre.
- Ejecutar cobros simultáneos de una misma orden: nunca superar el saldo.
- Consumir el mismo producto desde dos órdenes y registrar una compra concurrente: confirmar stock y costo consistentes.
- Simular fallo al crear auditoría/garantía: comprobar rollback de toda la transacción.
- Reintentar un pago tras una respuesta de red perdida: obtener el mismo pago.
- Comprobar restricciones con administrador, encargado de otra sucursal y técnico.
- Probar los formularios y diálogos en móvil, incluidos errores HTTP, fechas y entradas decimales.

## Siguiente etapa

Integrar el cotizador modular con las partidas de la orden y las tarifas configuradas; agenda con disponibilidad; panel diario y seguimientos; almacenamiento de fotos; PDF/QR; rutas específicas para tienda y alquiler; política de servicios combinados y conciliación de datos históricos.

El cotizador independiente conserva sus fórmulas previas. No se presenta el cálculo de margen como cálculo contable verificado ni se conecta todavía automáticamente a una orden. Las ampliaciones y devoluciones requieren un flujo explícito futuro.


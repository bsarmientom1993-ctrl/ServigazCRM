# Cotizador vinculado al cliente

Cotizador es la entrada al historial comercial y de servicios. Primero exige elegir un cliente registrado. El acceso desde Clientes → Cotizar / Ver historial abre el mismo registro.

Para un cliente nuevo, Registrar cliente y solicitud abre Nuevo trabajo. El alta del cliente y su primera orden se guardan juntas; la cotización se prepara después desde esa orden.

Para un cliente existente, Nueva cotización de servicio o compra abre Nuevo trabajo con ese cliente seleccionado. El asistente valida que pertenece al directorio autorizado y usa un borrador separado para ese cliente, sin reutilizar el borrador de otro cliente.

Cada servicio o compra tiene su propia orden y su relación obligatoria con Cliente. El historial muestra código, servicio, estado, última versión de la cotización, importe, pagos y acceso a la carta y seguimiento. Las versiones anteriores se conservan en la orden. El historial se carga por páginas de veinte registros.

Los encargados consultan clientes de su sucursal y únicamente las órdenes de su ámbito. El administrador consulta todas las sucursales. Los técnicos no acceden al cotizador ni al historial comercial de clientes.

Se retiró el cálculo independiente de /api/cotizador/calcular: responde 410 a sesiones de encargado o administrador y orienta hacia el flujo con cliente y orden. La emisión se realiza mediante la API de cotización de cada trabajo, que conserva cliente, importes y emisor en cada versión. Las instalaciones de gas mantienen la medición y visto bueno requeridos.

Pruebas: npm test, npm run typecheck, npm run test:clients, npm run test:wizard y npm run build. Las pruebas transaccionales usan únicamente PostgreSQL local con una base terminada en _test y un esquema temporal propio.

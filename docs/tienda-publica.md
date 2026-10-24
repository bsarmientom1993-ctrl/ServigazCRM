# Tienda pública de Servigaz

La tienda está en `/tienda` y funciona sin cuenta. El acceso del administrador se encuentra en **Tienda pública** del menú del CRM (`/gestion-tienda`). El inicio de sesión también tiene un enlace para los clientes.

## Preparar el catálogo

1. Crear equipos y materiales en **Almacenes y tiendas**, con su precio de venta.
2. Abrir **Tienda pública**, configurar el WhatsApp comercial, presentación y condiciones de pago/entrega.
3. Seleccionar cada producto, revisar el precio, escribir su descripción y añadir su fotografía opcional. Marcar **Publicar este producto** y guardar.
4. Activar **Abrir tienda** y guardar la configuración. Comprobar el resultado con **Ver tienda**.

El catálogo inicia cerrado, sin publicar automáticamente productos del inventario. Solo ADMIN configura o publica. La API pública selecciona únicamente productos publicados, activos y con precio positivo; no entrega costos, datos de clientes, ubicaciones ni cantidades de stock. Despublicar un producto, inactivarlo o cerrar la tienda impide acceder a su imagen pública.

## Pedido por WhatsApp

El cliente busca por categoría o texto, añade productos y modifica cantidades. El total se calcula en centavos con el precio del catálogo. El botón abre WhatsApp con nombres, códigos, cantidades y total referencial; el cliente revisa y envía el mensaje. Se solicita confirmación de disponibilidad, precio final, pago y entrega. No se envían mensajes automáticamente.

El carrito no descuenta stock, reserva productos, cobra ni crea una venta pagada. Después de confirmar por WhatsApp, el personal registra al cliente y la venta mediante el recorrido existente del CRM, manteniendo el historial y los movimientos de materiales/pagos. La instalación se cotiza aparte cuando corresponda.

## Fotografías

PNG, JPG o WebP, máximo 3 MB y 25 megapíxeles. El servidor verifica y convierte a JPEG de hasta 1000 px, eliminando metadatos. En producción usa la conexión R2 existente bajo `tienda/<productoId>/<hash>.jpg`. El bucket continúa privado y la ruta pública sirve solo imágenes de publicaciones vigentes. No se reutilizan fotos privadas de trabajos. El almacenamiento local en PostgreSQL se conserva como alternativa de pruebas con PHOTO_STORAGE=postgres. Las imágenes sustituidas se conservan en almacenamiento para evitar borrados accidentales; no hay purga automática.

## Verificación

`npm test` incluye precios y carrito, URL de WhatsApp, permisos de publicación, proyección pública e imágenes. `npm run test:store` realiza pruebas con PostgreSQL local aislado (TEST_DATABASE_URL terminada en _test). La migración aditiva e idempotente `scripts/migrate-store.cjs` se ejecuta en el build de Vercel.

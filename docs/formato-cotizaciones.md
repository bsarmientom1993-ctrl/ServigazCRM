# Formato de carta de cotización

La carta usa el diseño corporativo del modelo proporcionado: encabezado con marca y servicios, título centrado, fecha, asunto, proyecto y cliente; bloques de alcance y presupuesto en durazno; tabla con número, concepto, cantidad, costo unitario e importe; pie con sucursales y contactos. Los gráficos del encabezado y pie se extrajeron del modelo a alta resolución, sin publicar el PDF original ni sus textos de ejemplo.

Se conservan total cotizado, descuento, anticipo requerido, fecha de validez y firma con el nombre de la persona que emitió la cotización, sin su cargo. Los campos asunto, proyecto y nota se editan al preparar la propuesta y quedan congelados en su versión junto con el alcance y condiciones. Las cotizaciones anteriores tienen valores de respaldo y usan el emisor guardado o el nombre recuperado de auditoría. La fecha se muestra en la zona horaria de Bolivia.

La tabla presenta los conceptos globales del presupuesto almacenado como una unidad de cada partida; no inventa cantidades de piezas ni modifica los cálculos. Para gas, separa la mano de obra lineal del importe del proyecto para evitar duplicarlo, y muestra la medición y criterio aprobados. Las partidas de importe cero se omiten. La nota de plazos es editable; no se incorpora un tiempo de aprobación fijo tomado del ejemplo, porque depende de la entidad y de las observaciones.

La carta puede imprimirse o guardarse como PDF en tamaño carta. Las tablas permiten repetir encabezados y evitan dividir una fila; los alcances extensos pueden continuar en más páginas. El pie aparece al final del documento, sin superponerse al contenido. En dispositivos pequeños la hoja se desplaza horizontalmente para conservar la estructura de impresión.

Los permisos de emisión siguen limitados a encargado y administrador; la actualización de formato no concede acceso comercial a técnicos. No hay cambios de esquema de base de datos ni en el cálculo de precios, aceptación o pagos.


## Configuración por administrador

En **Precios y tarifas → Formato de cotizaciones**, ADMIN puede configurar empresa, título, encabezados de alcance y presupuesto, introducción, despedida, contactos, colores, letra y papel Carta/A4. La vista previa utiliza datos ficticios. Encargados y técnicos no pueden leer ni modificar este editor por API.

El encabezado y pie admiten PNG/JPG/WebP de hasta 500 KB cada uno, no animados; se valida el contenido real del archivo. Se puede usar texto o recuperar las imágenes del modelo original. Para cambiar los contactos impresos en la imagen original, usar texto o subir una imagen actualizada. No se admiten enlaces remotos, HTML ni SVG.

Guardar aplica la configuración global a las **nuevas versiones**. El servidor captura `carta.formato` al emitir: el navegador no puede imponer otro formato. Las versiones emitidas conservan sus textos e imágenes; las antiguas sin formato guardado usan el diseño original. Los cambios se auditan sin duplicar los archivos en el registro de auditoría. Siempre se mantienen importes, cliente, validez y nombre real del emisor; la firma no contiene el cargo.

La nueva tabla `FormatoCotizacion` se crea de forma aditiva e idempotente en el build de Vercel (`scripts/migrate-quote-template.cjs`). No se reemplazan configuraciones existentes.

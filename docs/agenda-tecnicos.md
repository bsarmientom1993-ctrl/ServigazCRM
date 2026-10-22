# Agenda y visitas del técnico

Las cuentas de técnicos ingresan a Mi agenda. El acceso antiguo al resumen redirige a esa vista. El menú muestra Mi agenda y Mis trabajos; la programación de nuevas órdenes permanece en las cuentas de encargado y administrador.

Se puede consultar un día o los próximos siete días, navegar al período anterior o siguiente, volver a Hoy y actualizar. Los horarios se muestran en America/La_Paz (UTC-4), incluyendo duración de atención y margen de traslado.

Cada visita muestra cliente, dirección, teléfonos, indicaciones para llegar, horario preferido, observaciones de coordinación y encargado. Cómo llegar utiliza el enlace de ubicación guardado o una búsqueda de ruta por dirección. Llamar usa el teléfono configurado en el cliente. Estas acciones se ejecutan únicamente al pulsarlas.

En móvil, el bloque Contacto del cliente aparece en cada visita y al inicio de la orden del técnico. Incluye el número visible y botones de al menos 48 px para Llamar, WhatsApp, Maps y Guardar contacto. Cada teléfono tiene sus propias acciones. Los números locales de ocho dígitos usan el prefijo de Bolivia (+591); los internacionales conservan su código de país. WhatsApp abre la conversación sin enviar mensajes. Si un número no permite determinar el código internacional, se solicita completarlo. Maps abre la ubicación guardada o la ruta por dirección. Guardar contacto descarga un archivo .vcf con nombre, teléfonos y dirección; el usuario lo abre en su aplicación Contactos y confirma guardarlo. Los datos faltantes se indican sin crear números ficticios.

La agenda muestra visitas pendientes, horarios pasados, completadas y canceladas. Un horario pasado no cambia el estado real de la visita. Las órdenes activas sin una próxima visita aparecen aparte para consultar al encargado.

El técnico solo consulta su propia agenda. Debe coincidir tanto la asignación de la visita como el técnico actual de la orden; una orden reasignada desaparece de la agenda del técnico anterior. No se devuelven precios, pagos ni datos de otros técnicos en esta API.

Abrir orden y visita conserva el identificador de la visita elegida. Al evaluar, se usa esa visita pendiente y asignada, no la última creada ni una visita ya completada. Los controles del servidor siguen comprobando asignación y estado al guardar. Los técnicos no reprograman visitas.

Las pruebas verifican roles, aislamiento por técnico, reasignaciones, límites de fechas en Bolivia, márgenes de traslado, estados y selección correcta de visitas. Ejecutar npm test y npm run test:agenda; la integración exige TEST_DATABASE_URL local terminada en _test y usa un esquema temporal propio.

## Información exclusiva para el trabajo técnico

Las cuentas técnicas no reciben cotizaciones, pagos, saldos, costos, precios del catálogo o del inventario, tarifas por metro ni márgenes. El detalle y la lista de trabajos usan una selección explícita de datos operativos y conservan el control de asignación. El seguimiento de gas conserva mediciones, visto bueno y proyecto, sin tarifas ni cálculos. Las respuestas de evaluación y ejecución tampoco devuelven los datos financieros internos. El resumen comercial y el catálogo de servicios requieren encargado o administrador.

El técnico registra consumos del inventario por producto y cantidad; el servidor calcula el costo interno sin enviárselo. Las compras externas y sus costos corresponden al encargado. La pantalla técnica muestra sus próximas acciones, mediciones, contacto, materiales por cantidad y evidencias; no presenta importes ni acceso a cartas de cotización. Las prácticas comerciales de ejemplo se reservan a encargados y administradores.

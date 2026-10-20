# Instalaciones y proyecto de gas

1. En Nuevo trabajo, selecciona el servicio de gas y marca si incluye proyecto.
2. El técnico completa la visita con fotos, condiciones y metros vistos y empotrados.
3. El encargado o administrador revisa las medidas y registra tarifas por metro, criterio y factor de dificultad de mano de obra (1 a 5). Debe ser una persona distinta del técnico que midió. Puede devolver la evaluación para corregirla.
4. Con visto bueno, completa alcance, condiciones, transporte y fecha de validez. Emite la cotización y abre Ver presupuesto para imprimir en tamaño carta o guardar como PDF.
5. Si incluye proyecto, registra responsable, fecha objetivo, referencia, notas y enlaces a documentos desde la ficha.
6. El proyecto avanza por pendiente, elaboración, revisión, presentación, aprobación y entrega. Las observaciones devuelven el proyecto a elaboración. La entrega es obligatoria antes del cierre final, junto con los controles de calidad, saldo y garantía existentes.

## Cálculo

- Materiales = metros vistos × tarifa de material visto + metros empotrados × tarifa de material empotrado.
- Mano de obra = (metros vistos × tarifa de mano de obra vista + metros empotrados × tarifa de mano de obra empotrada) × factor aprobado.
- Promedio por metro = (materiales + mano de obra) / metros totales.
- Total = materiales + mano de obra + importe del proyecto, si está incluido, + transporte − descuento autorizado.
- El proyecto puede tener importe cero si ya está incluido en el precio de instalación.

Los valores son revisados por cada orden; no se incorporan precios comerciales inventados. El servidor calcula los importes con precisión decimal desde la medición y aprobación guardadas. La carta separa materiales, mano de obra, proyecto y transporte.

Cada versión conserva una copia del cliente, alcance, condiciones, medición, tarifas y supervisor. La validez se elige al emitir; por defecto la API utiliza 15 días. Las cotizaciones vencidas no se aceptan.

Cambiar la inclusión del proyecto o corregir la medición invalida el visto bueno y reemplaza las cotizaciones pendientes. El alcance y las tarifas se fijan antes de aceptación o pagos. El avance documental puede continuar durante la ejecución y queda auditado por usuario y fecha.

## Datos y pruebas

El seguimiento se guarda en el campo JSON existente de la orden, sin cambios de esquema. Se conserva la preferencia horaria del cliente. Las revisiones y movimientos de proyecto quedan en el historial de auditoría.

Ejecutar npm test, npm run typecheck y npm run build. Para las pruebas transaccionales, configurar TEST_DATABASE_URL con PostgreSQL en localhost o 127.0.0.1 y nombre terminado en _test, y ejecutar npm run test:gas. Se crea y elimina únicamente un esquema temporal propio.

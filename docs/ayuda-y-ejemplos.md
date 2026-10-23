# Bienvenida, ayuda y trabajos de práctica

La guía se abre la primera vez que cada usuario entra a la aplicación desde ese navegador. Tiene seis pasos y adapta las instrucciones al rol de administrador, encargado o técnico. Permite avanzar, volver, saltar y salir con Escape. El botón **Ayuda** de la cabecera la vuelve a abrir; **Ayuda y práctica** en el menú abre las instrucciones completas.

La guía recuerda por usuario si fue completada o descartada. El almacenamiento es local al navegador; al cambiar de dispositivo o borrar los datos del navegador puede mostrarse nuevamente. Si el navegador bloquea el almacenamiento, la guía sigue funcionando.

En `/ayuda`, las instrucciones se pueden buscar y abrir por tema. Los enlaces de acciones reales se adaptan al rol. Desde Trabajos y órdenes también se puede entrar directamente a los ejemplos.

## Diez casos con procesos diferentes

- **EJEMPLO-001 · Gas:** comienza como solicitud nueva.
- **EJEMPLO-002 · Plomería:** parte de un presupuesto esperando la respuesta del cliente.
- **EJEMPLO-003 · Calefacción:** comienza en ejecución, con anticipo registrado.
- **EJEMPLO-004 · Servicio directo:** no necesita visita de medición y permite practicar el cobro total.
- **EJEMPLO-005 · Mantenimiento de calefón:** visita de diagnóstico coordinada, pendiente de evaluación.
- **EJEMPLO-006 · Equipo sin instalación:** venta aceptada; cobro total, salida de tienda, entrega y conformidad.
- **EJEMPLO-007 · Equipo con instalación:** anticipo registrado; preparación, instalación y revisión del resultado.
- **EJEMPLO-008 · Gas con proyecto observado:** instalación validada y pagada, pero proyecto observado; correcciones, revisión, nueva presentación, seguimiento diario, respuesta de la entidad y entrega antes del cierre.
- **EJEMPLO-009 · Instalación menor sin proyecto:** término técnico registrado; pendiente de calidad y cobro del saldo.
- **EJEMPLO-010 · Instalación cerrada:** calidad aprobada, pagos conciliados y proyecto entregado; muestra el resultado final.

El caso con proyecto mantiene un historial exclusivo. Registrar un seguimiento no aprueba el proyecto ni cambia el estado de la instalación. La respuesta favorable se etiqueta como simulada y el cierre queda bloqueado hasta la entrega. Los ejemplos de venta sin instalación usan instrucciones de entrega y conformidad, sin presentar esa entrega como una instalación.

## Recorridos completos y alternativas

Cada uno de los diez casos incluye el recorrido completo y un explorador de situaciones con pasos Anterior/Siguiente y resultado. Se cubren 48 situaciones distribuidas por servicio: corrección de mediciones, inclusión de proyecto, cambios y vencimiento de cotización, rechazo, solicitud de cancelación, anticipo parcial, reprogramación, falta de existencias, traspasos, alcance adicional, interrupciones, pendientes de calidad, falta de fotos, venta con/sin instalación, observaciones reiteradas de la entidad, seguimiento sin respuesta, aprobación pendiente de entrega, saldo pendiente, nuevas compras y reclamos de garantía.

Las alternativas son recorridos explicativos y no mutaciones de la orden de práctica. Se puede explorar una situación y volver al recorrido principal sin perder su progreso. Las situaciones de coordinación, cancelación o corrección no crean controles ni transiciones nuevas en las APIs operativas: explican qué debe documentar y resolver el encargado. No se afirma cubrir cada combinación posible de estados, importes, servicios o decisiones; se cubren los desenlaces principales de los diez procesos.

Los ejemplos son simulaciones interactivas, con clientes, técnicos, importes y costos ficticios. Se pueden completar hasta el cierre o reiniciar individualmente. Permiten recorrer tareas de distintos roles para comprender el proceso; esto no cambia permisos reales.

La práctica **no crea registros en la base**, no usa las APIs de operaciones ni altera métricas, finanzas, inventario, garantías o agendas. Los datos de práctica se mantienen separados mediante historial local por usuario. Al restaurarlo se verifican las transiciones y se reinicia solo un ejemplo corrupto. Esto permite ofrecer ejemplos en producción sin mezclar operaciones ficticias con las reales.

No es necesario ejecutar seeds, migraciones ni crear usuarios de demostración en producción.

## Comprobación

`npm test` verifica los diez estados de partida, sus recorridos hasta el cierre, las reglas de aceptación/anticipo/calidad/saldo, el bloqueo por proyecto pendiente, el historial exclusivo, la venta sin instalación, los reintentos inválidos, la restauración y el contenido por rol. `npm run build` compila la aplicación. La revisión visual comprueba la práctica y la persistencia de su progreso.

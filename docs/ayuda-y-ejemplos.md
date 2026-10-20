# Bienvenida, ayuda y trabajos de práctica

La guía se abre la primera vez que cada usuario entra a la aplicación desde ese navegador. Tiene seis pasos y adapta las instrucciones al rol de administrador, encargado o técnico. Permite avanzar, volver, saltar y salir con Escape. El botón **Ayuda** de la cabecera la vuelve a abrir; **Ayuda y práctica** en el menú abre las instrucciones completas.

La guía recuerda por usuario si fue completada o descartada. El almacenamiento es local al navegador; al cambiar de dispositivo o borrar los datos del navegador puede mostrarse nuevamente. Si el navegador bloquea el almacenamiento, la guía sigue funcionando.

En `/ayuda`, las instrucciones se pueden buscar y abrir por tema. Los enlaces de acciones reales se adaptan al rol. Desde Trabajos y órdenes también se puede entrar directamente a los ejemplos.

## Cuatro trabajos de ejemplo

- **EJEMPLO-001 · Gas:** comienza como solicitud nueva.
- **EJEMPLO-002 · Plomería:** parte de un presupuesto esperando la respuesta del cliente.
- **EJEMPLO-003 · Calefacción:** comienza en ejecución, con anticipo registrado.
- **EJEMPLO-004 · Servicio directo:** no necesita visita de medición y permite practicar el cobro total.

Los ejemplos son simulaciones interactivas, con clientes, técnicos, importes y costos ficticios. Se pueden completar hasta el cierre o reiniciar individualmente. Permiten recorrer tareas de distintos roles para comprender el proceso; esto no cambia permisos reales.

La práctica **no crea registros en la base**, no usa las APIs de operaciones ni altera métricas, finanzas, inventario, garantías o agendas. Los datos de práctica se mantienen separados mediante historial local por usuario. Al restaurarlo se verifican las transiciones y se reinicia solo un ejemplo corrupto. Esto permite ofrecer ejemplos en producción sin mezclar operaciones ficticias con las reales.

No es necesario ejecutar seeds, migraciones ni crear usuarios de demostración en producción.

## Comprobación

`npm test` verifica los estados de partida, el recorrido completo de los cuatro ejemplos, las reglas de aceptación/anticipo/calidad/saldo, los reintentos inválidos, la restauración y el contenido por rol. `npm run build` compila la aplicación. La revisión visual comprueba la bienvenida, su cierre y reapertura, la práctica y la persistencia de su progreso.

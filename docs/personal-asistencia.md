# Personal, permisos y asistencia

Acceso: `/personal`. Todos los roles internos consultan únicamente su propia información; el rol activo ADMIN puede consultar y configurar al equipo. `/asistencia` abre la misma herramienta en la pestaña de asistencia. Las cuentas externas de empresas instaladoras no tienen acceso.

## Preparación por el administrador

1. En Configuración, seleccionar cada persona y guardar sueldo mensual, fecha de ingreso/baja, horario, tolerancia, días laborales y sucursales autorizadas. Cada versión rige desde un mes determinado. No se crean sueldos ficticios en producción.
2. Guardar las reglas generales: divisor para el valor día, porcentaje por falta y porcentaje por una jornada con tardanza fuera de tolerancia. Ambos porcentajes se aplican al valor día, no al sueldo mensual completo. Configurar días no laborables como fechas, una por línea.
3. Definir el inicio del control: la primera activación no descuenta faltas de fechas anteriores. Las versiones posteriores pueden conservar esa fecha; no se puede alterar la de una versión existente.
4. Guardar las coordenadas del ingreso de cada sucursal y habilitarlo. El radio es fijo: 10 metros. El botón de ubicación ayuda a tomar las coordenadas cuando el administrador está físicamente junto al ingreso; no las obtiene automáticamente.

Los cambios requieren motivo y quedan en auditoría con su autor. Los períodos liquidados impiden cambios que afecten su resultado. Las versiones de sueldo y reglas solo se crean o modifican desde el mes actual en adelante.

## Acceso obligatorio y horario de marcación

Cada cuenta interna debe tener una entrada del día de Bolivia para abrir los módulos operativos. Se comprueba en el servidor en cada solicitud protegida, sin depender del rol ni del dispositivo. Una entrada habilita todos los roles asignados durante ese día; la del día anterior no sirve. Al cambiar de día se vuelve a solicitar asistencia.

Antes de marcar siguen disponibles la asistencia, los permisos/revisiones propios y las notificaciones. El administrador puede configurar Personal para preparar horarios y puntos de ingreso sin quedar bloqueado. No hay excepción de acceso operativo por ser administrador.

En la configuración laboral de cada persona, el administrador define **margen antes de la entrada** y **margen después de la salida**, de 0 a 240 minutos. Por defecto son 0. La ventana se limita al mismo día y a los días laborales, excluyendo las fechas no laborables. Por ejemplo, horario 08:30–18:00 y márgenes 15/30 permite marcar 08:15–18:30, incluyendo el minuto final. La tolerancia para tardanzas es independiente de estos márgenes. Preparar y guardar una marcación fuera de la ventana se rechaza en el servidor; cambiar la hora del teléfono no altera el horario permitido.

Si una persona no pudo marcar, solicita revisión y el administrador puede regularizarla con motivo. Los permisos de día completo no crean una asistencia automática.

Las notificaciones se consultan en su apartado o abriendo la campana. Ya no aparece un resumen automático al entrar al dashboard. Se conserva el sonido opcional elegido por el usuario y los avisos de dispositivo que haya activado.

## Jornada desde el teléfono

El trabajador elige una sucursal autorizada y pulsa Marcar entrada o Marcar salida. Debe permitir ubicación precisa. Se comprueba en el servidor una muestra reciente, ligada a una solicitud de 90 segundos, y que distancia al ingreso más precisión reportada no supere 10 metros. La salida requiere entrada en la misma sucursal. Los reintentos no duplican registros. Se guarda la hora del servidor en horario de Bolivia.

Una ubicación imprecisa no amplía el radio. El trabajador puede acercarse al ingreso y reintentar o solicitar revisión, explicando el problema. El administrador puede justificar el día o completar horas faltantes con motivo: la regularización queda identificada y nunca sustituye una marcación GPS existente.

La ubicación se solicita únicamente al marcar, sin seguimiento continuo. El navegador exige HTTPS y permiso del usuario. La geolocalización no garantiza una posición física exacta ni impide por sí sola la suplantación de coordenadas. Referencias: [W3C Geolocation](https://www.w3.org/TR/geolocation/), [MDN getCurrentPosition](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition).

## Permisos y revisiones

Los permisos son de día completo. El trabajador solicita fecha, motivo y, opcionalmente, enlace HTTPS a un comprobante. El administrador aprueba o rechaza y determina si tiene goce de haberes. Una solicitud propia requiere otro administrador. Se pueden retirar solicitudes pendientes y revocar aprobaciones con motivo, conservando historial.

El administrador dispone de una bandeja de solicitudes pendientes de todo el equipo. Antes de aprobar un permiso se deben reasignar las visitas técnicas pendientes de esa fecha. El permiso aprobado bloquea nuevas reservas y la marcación de ese día.

## Cálculo y cierre

- Sueldo del período: sueldo mensual prorrateado por días calendario de vinculación laboral dentro del mes.
- Valor día: sueldo mensual dividido por el divisor configurado.
- Falta: valor día multiplicado por el porcentaje configurado.
- Tardanza: una penalización por jornada, aplicando al valor día el porcentaje configurado, una vez superada la tolerancia.
- Permiso con goce o jornada justificada: sin descuento. Permiso sin goce: un valor día, independiente de la activación de penalizaciones por falta/tardanza.
- Los días futuros, no laborables y anteriores al inicio del control no generan faltas. Hoy sin entrada queda pendiente. Las solicitudes pendientes y las jornadas pasadas con entrada sin salida requieren revisión antes del cierre.
- El total de descuentos no supera el sueldo del período; el neto nunca es negativo.

El administrador puede liquidar únicamente meses terminados con reglas configuradas y revisiones resueltas. El cierre conserva una copia inmutable del cálculo y su autor. Anular exige motivo, conserva la versión anterior y permite emitir otra. El módulo no registra un pago bancario ni un egreso automáticamente. Las comisiones continúan en su apartado independiente.

Pruebas aisladas: `node --require ./tests/register.cjs --test tests/personnel.integration.cjs`, con `TEST_DATABASE_URL` de PostgreSQL local y nombre de base terminado en `_test`. No utilizar producción como base de pruebas.

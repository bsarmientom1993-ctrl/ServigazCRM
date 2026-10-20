# Perfiles y responsables

En Mi perfil cada usuario configura su nombre completo y teléfono. El administrador también puede modificar esos datos de las cuentas existentes desde Usuarios del equipo, en la misma página. Estas acciones no cambian el correo de acceso, contraseña, rol, estado ni sucursal.

El nombre se refleja inmediatamente en el entorno de la sesión. Cada persona debe ingresar con una cuenta propia para que se identifiquen correctamente sus acciones.

Los encargados y administradores emiten cotizaciones con su nombre sin cargo. Cada versión conserva el nombre utilizado al emitirla. Un cambio de perfil no modifica las firmas anteriores.

La ficha de cada orden incluye Quién realizó cada operación: solicitud, agenda, evaluación, cotización, confirmación de venta, pagos, consumos de materiales, ejecución, calidad, proyecto de gas y cierre. Los registros nuevos guardan el identificador de la cuenta y una copia de su nombre en el momento de la acción. Los registros anteriores muestran el nombre disponible en su cuenta. El historial muestra las últimas 100 operaciones autorizadas de esa orden.

La edición de perfiles también se audita con el usuario que realizó el cambio. Los encargados no pueden editar perfiles ajenos ni listar todo el equipo. Solo el administrador dispone de esas opciones.

No se requieren migraciones de base de datos. Validación: npm test, npm run typecheck, npm run test:profiles, npm run test:gas y npm run build. Las pruebas de integración requieren TEST_DATABASE_URL con PostgreSQL local y nombre terminado en _test; utilizan esquemas temporales propios.

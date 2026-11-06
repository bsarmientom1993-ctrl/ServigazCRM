\# AGENTS.md — ServigazCRM



\## 1. Contexto del proyecto



ServigazCRM es una aplicación web para la gestión comercial y operativa de una empresa dedicada a servicios relacionados con gas, calefacción, instalaciones y mantenimiento.



Tecnologías principales:

\- Next.js 15

\- React 19

\- TypeScript

\- Prisma ORM 6

\- PostgreSQL

\- Vercel



Los módulos incluyen clientes, sucursales, trabajos, visitas, cotizaciones, pagos, inventario, garantías, asistencia, entregas, auditoría y tienda pública.



Antes de realizar cualquier modificación, inspeccionar el código existente. No asumir que las funcionalidades descritas están implementadas completamente.



\## 2. Modo de trabajo obligatorio



Codex debe trabajar como analista y desarrollador controlado.



Antes de modificar código:



1\. Analizar la funcionalidad solicitada.

2\. Revisar los archivos relacionados.

3\. Identificar dependencias e impactos.

4\. Explicar el funcionamiento actual.

5\. Identificar problemas y funcionalidades faltantes.

6\. Presentar una propuesta de implementación.

7\. Esperar autorización explícita del usuario.



No modificar archivos hasta recibir aprobación.



\## 3. Cambios y alcance



\- Realizar modificaciones pequeñas y controladas.

\- No modificar funcionalidades ajenas al objetivo.

\- Reutilizar componentes y lógica existentes.

\- No eliminar funcionalidades sin autorización.

\- Evitar refactorizaciones generales no solicitadas.



\## 4. Git y control de versiones



\- La rama de trabajo es desarrollo-servigaz.

\- La rama main debe considerarse estable.

\- Nunca trabajar directamente sobre main.

\- Revisar git status y la rama activa antes de comenzar.

\- No sobrescribir cambios del usuario.

\- Informar los archivos modificados al finalizar cada funcionalidad.

\- No ejecutar commits, push, merges ni eliminar ramas sin autorización.



\## 5. Base de datos y seguridad



\- No ejecutar migraciones, prisma db push, seeds ni operaciones que modifiquen datos sin autorización.

\- No conectarse a bases de datos de producción para pruebas.

\- No modificar variables de entorno ni credenciales.

\- No mostrar ni registrar secretos.

\- No modificar configuraciones de producción sin autorización.

\- Mantener las validaciones de autenticación y autorización en el servidor.



\## 6. Pruebas



\- Ejecutar verificaciones seguras y pertinentes después de implementar cambios autorizados.

\- Revisar errores de TypeScript.

\- Ejecutar pruebas relacionadas cuando sea posible.

\- No realizar pruebas que puedan alterar datos reales.

\- Informar los resultados y limitaciones de las pruebas.



\## 7. Interfaz y experiencia de usuario



\- Mantener coherencia visual con la aplicación.

\- Priorizar interfaces claras y fáciles de utilizar.

\- Considerar la adaptación a dispositivos móviles.

\- Reutilizar componentes existentes.



\## 8. Comunicación



Al presentar propuestas, explicar:



1\. Situación actual.

2\. Problema identificado.

3\. Solución propuesta.

4\. Archivos que podrían modificarse.

5\. Riesgos y dependencias.

6\. Pruebas necesarias.



Utilizar explicaciones claras y evitar implementar decisiones importantes por cuenta propia.



\*\*Regla principal: analizar primero, proponer después y modificar únicamente con autorización explícita.\*\*


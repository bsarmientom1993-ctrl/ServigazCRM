# Registro fotográfico del trabajo

Cada orden dispone de dos carpetas privadas: Requerimiento inicial e Instalación terminada. El menú Registro fotográfico permite buscar por cliente y código; la orden y el historial comercial del cliente enlazan sus carpetas.

Las fotos iniciales corresponden al técnico asignado a la evaluación o al encargado/administrador del ámbito de la orden. Se añaden antes de la aceptación para documentar lo solicitado y preparar la cotización. La evaluación utiliza las fotos de esta carpeta (mínimo tres).

Al aceptar la propuesta se habilita la carpeta final. Pueden añadir fotos el técnico asignado, otros técnicos activos de la misma sucursal y encargados/administradores autorizados para esa orden. El permiso adicional de los técnicos de la sucursal solo cubre el registro fotográfico; no amplía el detalle del trabajo ni permite consultar precios o pagos. Las fotos finales de cualquiera de esos autores sirven para registrar el término técnico (mínimo dos), manteniendo los permisos existentes de finalización y cierre.

Se puede tomar una foto o elegir varias desde la galería. El navegador optimiza la imagen; el servidor valida su contenido real y la convierte a JPEG de hasta 1600 píxeles y 768 KiB, sin conservar EXIF. Se guardan autor y nombre usado al registrar, fecha de carga y descripción opcional. Las imágenes se consultan o descargan previa autenticación. La descripción corresponde al registro, no se infiere la fecha de captura de la foto.

Hay un máximo de 20 fotos por carpeta. Los reintentos conservan la misma clave de solicitud y el contenido repetido en una carpeta no crea copias adicionales. No se borran ni reemplazan evidencias desde esta función. Los registros en miniatura y su descarga se sirven por rutas privadas, verificando acceso en cada solicitud. Las referencias utilizadas en la evaluación o el término se validan contra la orden y la carpeta respectivas. Los enlaces externos anteriores se conservan como evidencias heredadas.

Persistencia: tabla FotoTrabajo en PostgreSQL (BYTEA), fuera del repositorio y del disco temporal de Vercel. No requiere credenciales de otro servicio. scripts/migrate-photos.cjs crea la tabla y los índices de forma aditiva e idempotente; el build de Vercel la ejecuta antes de publicar. El almacenamiento consume espacio de la base existente: conviene vigilar su capacidad y migrar los binarios a almacenamiento de objetos si crece el volumen; los límites por foto y carpeta no sustituyen el control del espacio total.

Pruebas: npm test y npm run test:photos. La integración exige TEST_DATABASE_URL local terminada en _test y usa un esquema temporal aislado. Verifica persistencia y descarga privada, permisos entre sucursales, colaboración de otro técnico sin acceso financiero, reintentos concurrentes, validación de archivos, cuotas y uso de las imágenes como evidencia en la evaluación y el término.

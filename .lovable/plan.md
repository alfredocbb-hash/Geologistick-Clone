

## Plan: Exportar estructura y datos de la base de datos

### Qué se hará
Ejecutar un script que genere un archivo SQL completo con:
1. **Estructura (CREATE TABLE)** de las 70 tablas del esquema `public`
2. **Datos (INSERT INTO)** de todas las tablas
3. **Funciones, triggers, tipos y enums** del esquema público
4. **Índices y constraints** (foreign keys, unique, etc.)

### Método
Se usará `pg_dump` con las variables de entorno ya configuradas para exportar el esquema `public` completo. El archivo resultante se guardará en `/mnt/documents/` para descarga directa.

### Resultado
Un archivo `database_dump.sql` descargable con todo lo necesario para recrear la base en otro servidor PostgreSQL.

### Nota importante
- Se excluyen los esquemas internos (`auth`, `storage`, `realtime`, etc.) ya que son propios de la infraestructura actual
- Las contraseñas de usuarios **no** se exportan (están en `auth.users` que es un esquema reservado)
- Las políticas RLS se incluirán para referencia


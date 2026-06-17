ary
# Migración a PostgreSQL 17: Exportación completa

Generaré tres archivos `.sql` descargables en `/mnt/documents/` que podrás importar en tu nuevo PostgreSQL 17.

## Archivos a generar

### 1. `01_schema.sql` — Estructura
- ~85 tablas del esquema `public` con `CREATE TABLE`, PK, FK, índices, constraints
- Tipos ENUM personalizados (app_role, shipment_status, payment_method, etc.)
- ~50 funciones del esquema `public` (incluye `has_role`, `current_user_tenant`, `start_ruta_planificada`, triggers, etc.)
- Triggers de `public`
- Políticas RLS (las líneas con `auth.uid()` quedarán comentadas con nota, ya que PostgreSQL puro no tiene el esquema `auth` de Supabase)
- GRANTs

### 2. `02_data.sql` — Datos
- `INSERT` statements por tabla, en orden de dependencias (FKs)
- Envuelto en una transacción con `SET session_replication_role = replica` para desactivar triggers durante la carga masiva
- Manejo correcto de `jsonb`, `uuid`, `timestamptz`, arrays, caracteres especiales
- Si alguna tabla supera ~100MB de INSERTs, se divide en `02_data_<tabla>.sql`

### 3. `03_auth_users.sql` — Usuarios
- Tabla `public._migrated_auth_users` con: `id`, `email`, `encrypted_password` (bcrypt de GoTrue), `created_at`, `last_sign_in_at`, `raw_user_meta_data`, `email_confirmed_at`
- Nota: si tu nuevo sistema de auth no es compatible con bcrypt de GoTrue, los usuarios deberán resetear contraseña

## Orden de importación
```text
psql < 01_schema.sql
psql < 03_auth_users.sql
psql < 02_data.sql
```

## Qué NO se incluye (limitaciones de Lovable Cloud)
- Esquemas gestionados por Supabase: `auth`, `storage`, `realtime`, `vault`, `supabase_functions`
- Edge Functions (código TypeScript) — debes portarlas manualmente
- Secrets / variables de entorno
- Archivos de Storage buckets
- Cron jobs (`pg_cron`), webhooks de DB, extensión `pg_net`

## Detalles técnicos
- Construcción del esquema desde `information_schema` + `pg_catalog` (`pg_class`, `pg_attribute`, `pg_constraint`, `pg_proc`, `pg_policy`, `pg_trigger`)
- Datos vía `COPY (SELECT ...) TO STDOUT` y script Python que reconstruye `INSERT`s seguros
- Reporte final `MIGRATION_REPORT.md` con conteo de filas por tabla y notas de adaptación

Al aprobar este plan ejecutaré la exportación y te entregaré los archivos para descarga.

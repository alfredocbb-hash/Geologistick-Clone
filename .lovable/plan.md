

# Fix: constraint único en `tarifa_conceptos.codigo` debe ser por tenant

## Problema
La tabla `tarifa_conceptos` tiene un constraint `UNIQUE (codigo)` global. Esto significa que si un tenant (ej. Beraexpress) ya tiene un concepto con código "FLETE", otro tenant (ej. Blackbox) no puede crear uno con el mismo código. El error es: `duplicate key value violates unique constraint "tarifa_conceptos_codigo_key"`.

## Solución
Reemplazar el constraint `UNIQUE (codigo)` por un constraint compuesto `UNIQUE (codigo, tenant_id)`. Esto permite que cada tenant tenga sus propios códigos sin colisionar con otros.

## Cambios

### 1. Migración SQL
- `DROP` el constraint actual `tarifa_conceptos_codigo_key`
- `CREATE` un nuevo constraint `UNIQUE (codigo, tenant_id)` — esto permite el mismo código en diferentes tenants, y también permite conceptos globales (`tenant_id IS NULL`) siempre que no repitan código entre sí.

### 2. Sin cambios en código frontend
El código de inserción/actualización ya maneja `tenant_id` correctamente. Solo falta arreglar el constraint en la base de datos.

## Archivo a modificar
1. **Migración SQL** — cambiar constraint de `UNIQUE (codigo)` a `UNIQUE (codigo, tenant_id)`


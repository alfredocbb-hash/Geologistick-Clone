
## Adelantos a Choferes desde Caja

Permitir que Administración registre un egreso de caja del tipo "Adelanto a Chofer", vinculado a un chofer específico, que luego se descuente automáticamente al liquidar al chofer.

### Cambios en base de datos

Migración para extender `movimientos_caja`:
- Agregar columna `chofer_id UUID` (nullable, FK lógica a `profiles.user_id`).
- Agregar columna `categoria TEXT` (nullable) para tipificar movimientos: `adelanto_chofer`, `gasto_operativo`, `otro`.
- Agregar columna `descontado_en_liquidacion_id UUID` (nullable) para marcar cuando ya fue aplicado a una liquidación de chofer y evitar doble descuento.
- Index en `(chofer_id, descontado_en_liquidacion_id)` para queries de adelantos pendientes.

### UI - Página Caja (`src/pages/Cash.tsx`)

En el diálogo "Nuevo Movimiento" (cuando `tipo = egreso`):
- Nuevo Select **Categoría**: "Adelanto a Chofer", "Gasto Operativo", "Otro".
- Si se elige "Adelanto a Chofer": aparece un Select **Chofer** (lista de usuarios con rol `chofer` de la sucursal/tenant). Campo obligatorio.
- El concepto se autocompleta como "Adelanto a [Nombre Chofer]" pero editable.
- Al guardar se persiste `chofer_id` y `categoria = 'adelanto_chofer'`.

En el listado de movimientos:
- Mostrar badge "Adelanto a [Chofer]" cuando aplique.

### Nueva pestaña "Adelantos" en Caja

Tab adicional que lista todos los adelantos del tenant con filtros por chofer y estado (pendiente de descuento / descontado), mostrando monto, fecha, sucursal y sesión de caja.

### Integración con Liquidación de Choferes (`src/pages/DriverSettlements.tsx`)

Al calcular la liquidación de un chofer en un período:
- Buscar adelantos en `movimientos_caja` con `chofer_id = X`, `categoria = 'adelanto_chofer'`, `descontado_en_liquidacion_id IS NULL`, fecha dentro del rango.
- Mostrarlos como línea de descuento ("Adelantos otorgados") restando del monto a pagar.
- Al confirmar/aprobar la liquidación, actualizar esos movimientos con `descontado_en_liquidacion_id` para marcarlos como aplicados.
- Si se anula la liquidación, revertir el `descontado_en_liquidacion_id` a NULL.

### Validaciones

- Solo Admin / Super Admin pueden registrar adelantos (resto puede ver pero no crear).
- No permitir registrar adelantos si la caja no está abierta.
- El monto debe ser > 0.
- El chofer debe pertenecer al mismo tenant.

### Archivos a modificar

- `supabase/migrations/<nuevo>.sql` — schema changes
- `src/pages/Cash.tsx` — diálogo + tab adelantos
- `src/pages/DriverSettlements.tsx` — descuento en liquidación
- (opcional) `src/components/cash/AdvanceToDriverBadge.tsx` — badge visual

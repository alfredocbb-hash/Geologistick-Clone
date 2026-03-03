
# Fix: Usuarios con rol "sucursal" no pueden cancelar envíos

## Problema confirmado

Verifiqué directamente en la base de datos:
- Los 3 envíos `SUC07BERA-ENV-20260303-*` siguen en estado `en_sucursal` (no cancelados)
- El historial muestra 4 intentos de cancelación (2 envíos x 2 intentos cada uno) — el usuario intentó varias veces
- El toast "Envío cancelado exitosamente" aparece porque el código no detecta que el UPDATE no afectó filas

**Causa raíz**: La política RLS de UPDATE en `envios` solo permite actualizar a usuarios con rol `admin` o al chofer asignado. El usuario `bahiablanca@blackbox.com` tiene rol `sucursal`, por lo tanto:
1. El UPDATE a `envios` falla silenciosamente (0 filas afectadas, sin error)
2. El INSERT a `envio_historial` sí funciona (RLS diferente)
3. El código no verifica si el UPDATE realmente modificó filas → muestra éxito falso

## Solución

### 1. Actualizar política RLS de UPDATE en `envios`
Agregar los roles `sucursal`, `operador` y `despachador` a la política de UPDATE, permitiéndoles actualizar envíos de su sucursal (origen o destino).

### 2. Validar que el UPDATE realmente afectó filas
En `Shipments.tsx` y `ChangeStatusDialog.tsx`, después del UPDATE verificar que se retornó data. Si no, lanzar error explicativo.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| Migración SQL | Ampliar política RLS de UPDATE en `envios` para incluir roles `sucursal`, `operador`, `despachador` |
| `src/pages/Shipments.tsx` | Validar que el UPDATE afectó filas antes de mostrar éxito |
| `src/components/shipments/ChangeStatusDialog.tsx` | Misma validación |

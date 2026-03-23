

## Plan: Corregir concepto "por día" que se aplica por envío

### Problema
El concepto "Retiro" ($7.000) se muestra y suma en cada fila de envío individual porque el registro existente en la base de datos tiene `multiplicar_por_dias = false` (fue creado antes de la migración). No hay forma de editar conceptos de tarifas existentes.

### Solución (2 partes)

**1. Actualizar registros existentes vía migración**
- Ejecutar un `UPDATE` que marque `multiplicar_por_dias = true` en todos los `tarifa_concepto_precios` cuyo concepto tenga el código `RECARGO_DIA` (o nombre que contenga "retiro" / "día"), para que los registros preexistentes funcionen correctamente sin recrear la tarifa.

**2. Permitir editar conceptos de tarifas de seller existentes**
- En la página de Sellers o en `CreateSellerTarifaDialog`, agregar la posibilidad de **editar** los conceptos adicionales de una tarifa ya creada, incluyendo el toggle "Cobro por día (lun-vie)". Esto evita que el usuario tenga que borrar y recrear la tarifa.

### Alternativa más simple (recomendada)
Si el usuario prefiere una solución rápida: solo la migración que actualice los registros existentes, y luego el sistema ya funcionará correctamente (el motor de liquidación ya tiene la lógica implementada para separar cargos por día de cargos por envío).

### Archivos a modificar
- Migración SQL (actualizar registros existentes)
- Opcionalmente: `CreateSellerTarifaDialog.tsx` (agregar modo edición de conceptos)




## Plan: Agregar estado de liquidación a envíos en liquidaciones de seller

### Problema actual

Cuando se calcula una liquidación de seller, los envíos ya liquidados se **excluyen completamente** del resultado (filtro `.is('liquidacion_seller_id', null)`). Esto impide al usuario ver cuáles envíos del período ya fueron procesados en liquidaciones anteriores, a diferencia del flujo de choferes que muestra todos los envíos con badges "A liquidar" / "Liquidado".

### Cambios propuestos

**Archivo: `src/pages/ecommerce/Settlements.tsx`**

1. **Remover el filtro `.is('liquidacion_seller_id', null)` de las 4 queries de envíos** (líneas 485, 522, 535, 594) para traer **todos** los envíos del período, liquidados o no.

2. **Agregar campo `estado_liquidacion`** al tipo `CalculatedEnvio`: `'a_liquidar' | 'liquidado'`, determinado por si el envío tiene `liquidacion_seller_id` distinto de null.

3. **Adaptar las queries** para incluir el campo `liquidacion_seller_id` en el `select`, y marcar cada envío con su estado.

4. **Actualizar los stats** del calculador:
   - Mostrar conteo de "A liquidar" vs "Liquidados"
   - Solo sumar precios de envíos "a_liquidar" en los totales

5. **Agregar columna "Estado Liq." a la tabla de envíos** en la pre-visualización (~línea 1440):
   - Badge naranja "A liquidar" para envíos sin liquidar
   - Badge verde "Liquidado" para envíos ya liquidados (fila con `opacity-60`)
   - Los envíos liquidados no son editables en precio

6. **Proteger la generación**: el `generateMutation` solo procesa envíos con `estado_liquidacion === 'a_liquidar'` (ya no depende del filtro de la query).

### Detalle técnico

- Se modifica la query de envíos para incluir `liquidacion_seller_id` en el select
- Se agrega la propiedad `estado_liquidacion` al tipo `CalculatedEnvio`
- Se agrega lógica de filtrado en `generateMutation` para solo vincular envíos con `estado_liquidacion === 'a_liquidar'`
- Se replica el patrón visual exacto del `DriverSettlements.tsx` (badges, opacity, protección de edición)

### Archivo a modificar
- `src/pages/ecommerce/Settlements.tsx`




## Plan: Excluir envíos ya liquidados en Liquidaciones de Sucursales

### Problema

Al calcular una nueva liquidación de sucursal, la query trae **todos** los envíos entregados/devueltos del período sin verificar si ya fueron incluidos en una liquidación previa. Esto causa que los mismos envíos aparezcan en múltiples liquidaciones.

### Causa raíz

No hay filtro que excluya los envíos que ya tienen un registro en `liquidacion_sucursal_detalles` vinculado a una liquidación activa (no cancelada).

### Solución

**`src/pages/BranchSettlements.tsx`** — En la mutación `calculateMutation`, después de obtener y deduplicar los envíos (línea ~221), agregar un paso que:

1. Tome todos los IDs de envíos obtenidos
2. Consulte `liquidacion_sucursal_detalles` para ver cuáles ya están vinculados a una liquidación
3. Cruce con `liquidaciones_sucursal` para excluir solo los que pertenecen a liquidaciones **no canceladas** (estado ≠ 'cancelada')
4. Filtre los envíos ya liquidados del array antes de proceder con el cálculo de comisiones

### Lógica

```text
envíos del período
  → obtener IDs
  → consultar liquidacion_sucursal_detalles WHERE envio_id IN (ids)
  → JOIN liquidaciones_sucursal WHERE estado != 'cancelada'
  → remover esos envio_ids del cálculo
```

| Archivo | Cambio |
|---------|--------|
| `BranchSettlements.tsx` | Filtrar envíos ya liquidados en `calculateMutation` antes del cálculo de comisiones |

No se requiere migración de base de datos.


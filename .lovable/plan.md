

## Plan: Excluir envíos entregados en sucursal de la liquidación de choferes

### Problema

La consulta de cálculo en `DriverSettlements.tsx` no distingue entre envíos entregados a domicilio por el chofer y envíos entregados en mostrador de sucursal. Si un chofer transportó el paquete pero la entrega final fue en sucursal, el envío aparece incorrectamente en su liquidación porque su ID sigue en `chofer_id` / `chofer_ultima_milla_id`.

### Cambio propuesto

**Archivo:** `src/pages/DriverSettlements.tsx`

En las dos queries de cálculo (por `fecha_entrega` y por `ruta_paradas`), agregar el filtro:

```typescript
.or('entregado_en_sucursal.is.null,entregado_en_sucursal.eq.false')
```

Esto excluye los envíos donde `entregado_en_sucursal = true`, asegurando que solo se liquiden envíos que el chofer entregó efectivamente a domicilio.

### Detalle técnico

1. **Query por fecha_entrega** (línea ~217): agregar filtro `entregado_en_sucursal` 
2. **Query por ruta_paradas** (línea ~248): agregar el mismo filtro
3. Ambas queries ya filtran por `estado = 'entregado'`, solo falta esta condición adicional

### Impacto

- Solo afecta el cálculo de nuevas liquidaciones
- Las liquidaciones ya generadas no se modifican
- Los envíos entregados en sucursal seguirán apareciendo en las liquidaciones de sucursal (donde corresponden)


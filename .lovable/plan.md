

# Fix: Recalcular comisiones con configuración actual del chofer

## Problema

En `DriverSettlements.tsx` línea 294, cuando ya existen registros en la tabla `comisiones` para un envío (de un cálculo previo), el sistema usa el monto viejo guardado en vez de recalcular con la configuración actual del chofer:

```typescript
comision_calculada: comision?.monto ?? comisionCalculada,
```

Como Lucas Galarza ya tuvo cálculos previos con comisión fija, esos montos quedaron en la tabla `comisiones` y se siguen mostrando aunque ahora esté configurado con porcentaje.

## Cambio

### `src/pages/DriverSettlements.tsx` (línea 294)

Solo usar el monto guardado si el envío **ya fue liquidado** (tiene `liquidacion_id`). Si está pendiente ("a liquidar"), siempre recalcular con la configuración actual:

```typescript
// Antes:
comision_calculada: comision?.monto ?? comisionCalculada,

// Después:
comision_calculada: comision?.liquidacion_id ? (comision.monto ?? comisionCalculada) : comisionCalculada,
```

Esto asegura que:
- Envíos **ya liquidados** → mantienen el monto original (no se modifica lo cerrado)
- Envíos **pendientes** → siempre recalculan con la configuración actual del chofer

Adicionalmente, invalidar el cache de choferes al calcular para asegurar que se lea la configuración más reciente.


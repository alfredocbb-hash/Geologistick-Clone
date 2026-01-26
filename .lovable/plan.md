
# Plan: Corregir Error "null tracking_number" en Envíos Terciarizados

## Diagnóstico del Problema

El error **"null value in column 'tracking_number' of relation 'envios' violates not-null constraint"** ocurre porque:

1. **No se maneja el error** de la llamada RPC a `generate_tracking_number`
2. **No se pasa el parámetro** `p_sucursal_id` que otros componentes sí envían
3. Si la función RPC falla silenciosamente, `trackingData` queda como `null` y se intenta insertar así

### Código Actual (Problemático)
```typescript
// Línea 231 - No maneja errores ni pasa sucursal_id
const { data: trackingData } = await supabase.rpc("generate_tracking_number");
```

### Código en Otros Componentes (Correcto)
```typescript
// En NewShipment.tsx y CreateShipmentFromOrderDialog.tsx
const { data: trackingData, error: trackingError } = await supabase
  .rpc('generate_tracking_number', { p_sucursal_id: sucursalOrigenId });

if (trackingError) throw trackingError;
```

## Solución

Corregir la llamada RPC en `ThirdPartyShipmentsTab.tsx`:

1. **Capturar errores** del RPC
2. **Pasar `p_sucursal_id`** usando `profile?.sucursal_id`
3. **Validar** que se haya generado el tracking antes de insertar
4. **Mostrar error descriptivo** si falla la generación

## Archivo a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/routes/ThirdPartyShipmentsTab.tsx` | Corregir llamada RPC en línea 231 |

## Cambios Detallados

### Antes (Línea 231)
```typescript
const { data: trackingData } = await supabase.rpc("generate_tracking_number");
```

### Después
```typescript
// Generate tracking number with branch code
const { data: trackingData, error: trackingError } = await supabase
  .rpc("generate_tracking_number", { p_sucursal_id: profile?.sucursal_id });

if (trackingError) {
  throw new Error(`Error al generar tracking: ${trackingError.message}`);
}

if (!trackingData) {
  throw new Error("No se pudo generar el número de tracking");
}
```

## Resultado Esperado

- Los envíos terciarizados se crearán correctamente con un tracking number válido (ej: `SUC-ENV-20260126-A1B2C3`)
- Si hay un error en la generación, el usuario verá un mensaje claro en lugar de un error de base de datos

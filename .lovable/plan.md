

# Fix: Hoja de ruta de reparto — tracking externo, importes destino, y total

## Problemas

1. **Envíos terciarizados muestran tracking interno**: La columna Tracking muestra `tracking_number` para todos. Los terciarizados deberían mostrar `tracking_externo`.
2. **No se muestran importes de pago en destino**: La columna COD solo muestra monto cuando `pago_contra_entrega && tipo_pago === 'contra_entrega'`. Los envíos con `tipo_pago === 'destino'` no muestran importe.
3. **Falta el total a cobrar**: No hay fila/sección con el total de importes a cobrar por el chofer.

## Solución

Un solo archivo: `src/pages/PrintPlannedRoute.tsx`

### 1. Agregar campos faltantes al query (línea ~49)
Agregar `es_terciarizado`, `tracking_externo`, `empresa_terciarizada` al select de `envios`.

### 2. Mostrar tracking externo para terciarizados (línea ~283)
```typescript
// En vez de solo envio?.tracking_number:
{envio?.es_terciarizado && envio?.tracking_externo 
  ? envio.tracking_externo 
  : envio?.tracking_number}
```

### 3. Mostrar importes de pago destino (línea ~296)
Ampliar la condición de COD para incluir `tipo_pago === 'destino'`:
```typescript
const showCobro = (envio?.pago_contra_entrega && envio?.tipo_pago === 'contra_entrega') 
  || envio?.tipo_pago === 'destino';
```

### 4. Agregar fila de total al pie de la tabla
Después del `tbody`, agregar un `tfoot` con el total de todos los importes a cobrar (COD + destino).

### 5. Actualizar el resumen
Ajustar la sección RESUMEN para que el cálculo de "Cobros COD" también incluya los envíos con `tipo_pago === 'destino'`, y renombrar a "Total a Cobrar".


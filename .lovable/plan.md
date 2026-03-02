

# Fix: Sincronizar campo estado_ml en webhook y corregir envío 46563112028

## Problema

MercadoLibre muestra el envío 46563112028 como "reprogramado" (`shipped/rescheduled`), pero el sistema interno muestra `estado_ml = pendiente`. Esto ocurre porque:

1. El webhook (`mercadolibre-webhook`) actualiza el `estado` interno pero **nunca actualiza `estado_ml`**
2. La función de sync tampoco actualizó este envío porque su estado interno es `incidencia`

## Solución

### 1. Corregir el webhook para actualizar `estado_ml`

**Archivo:** `supabase/functions/mercadolibre-webhook/index.ts`

En la sección donde se actualiza un envío existente (aprox. línea 210), agregar `estado_ml` al UPDATE:

```typescript
// Antes:
await supabase.from('envios').update({
  estado: mapping.estado_interno,
  ml_sync_status: 'synced',
  ml_last_sync_at: now,
}).eq('id', existingEnvio.id);

// Después:
await supabase.from('envios').update({
  estado: mapping.estado_interno,
  estado_ml: shipment.status,
  ml_sync_status: 'synced',
  ml_last_sync_at: now,
}).eq('id', existingEnvio.id);
```

También agregar `estado_ml` en el caso donde no hay cambio de estado (solo sync timestamp), para que siempre refleje el último estado conocido de ML:

```typescript
// En el else (sin cambio de estado):
await supabase.from('envios').update({
  estado_ml: shipment.status,
  ml_sync_status: 'synced',
  ml_last_sync_at: now,
}).eq('id', existingEnvio.id);
```

### 2. Corregir datos del envío 46563112028

**SQL Migration:** Actualizar el `estado_ml` de este envío específico para reflejar el estado real de ML.

```sql
UPDATE envios
SET estado_ml = 'shipped',
    ml_sync_status = 'synced',
    ml_last_sync_at = now()
WHERE ml_shipment_id = 46563112028;
```

### 3. Agregar `estado_ml` al UPDATE de ecommerce_orders en el webhook

En la misma sección del webhook, el `ml_shipping_status` de `ecommerce_orders` ya se actualiza correctamente. Solo verificar que sigue funcionando.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/mercadolibre-webhook/index.ts` | Agregar `estado_ml: shipment.status` en los dos UPDATE de envíos existentes |
| Base de datos (SQL) | Corregir `estado_ml` del envío 46563112028 |

## Impacto

- Futuras notificaciones de ML actualizarán correctamente `estado_ml`
- La UI mostrará el estado real de ML en la columna correspondiente
- Las discrepancias entre estado interno y ML serán visibles para los operadores

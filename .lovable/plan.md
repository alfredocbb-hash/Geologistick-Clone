

## Plan: Extraer horario de entrega de ML en la sincronización

### Problema
El envío ML-46848602811 tiene horario comercial en Mercado Libre, pero los campos `horario_entrega_desde`, `horario_entrega_hasta` y `horario_preferido_entrega` están vacíos en la base de datos. Esto ocurre porque la función `mercadolibre-sync` **no extrae el `time_frame`** de la API de ML al crear envíos — solo lo hacen `mercadolibre-webhook` y `register-ml-shipment`.

### Solución
Replicar la lógica de extracción de `time_frame` (que ya existe en el webhook) dentro de `mercadolibre-sync`, para que los envíos creados por sincronización también tengan sus horarios de entrega.

### Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/mercadolibre-sync/index.ts` | Extraer `lead_time.estimated_delivery_time.time_frame` del shipment y guardar `horario_preferido_entrega`, `horario_entrega_desde`, `horario_entrega_hasta` en el insert de `envios` |

### Detalle técnico
Se agregará el mismo bloque que usa el webhook (líneas 210-225 de `mercadolibre-webhook/index.ts`):

```typescript
const timeFrame = shipment.lead_time?.estimated_delivery_time?.time_frame;
let horarioPreferido = 'cualquier_hora';
let horarioEntregaDesde = null;
let horarioEntregaHasta = null;
if (timeFrame?.from != null && timeFrame?.to != null) {
  // Convertir a HH:MM y determinar preferencia
}
```

Y se incluirán los 3 campos en el `insert` de envíos (línea ~503).

### Nota
Los envíos **ya existentes** que se sincronizaron sin estos datos no se corregirán automáticamente. Si se desea actualizar los existentes, se podría hacer una re-sincronización o un script puntual.




## Plan: Marcadores de mapa, estado ML, QR de pedidos y horarios en planificador

### 1. Marcadores de orden mas visibles (DeliveryStopMarker)

**Archivo**: `src/components/maps/DeliveryStopMarker.tsx`

Cambios en el `Marker`:
- `scale`: 1.5 → 2.0
- `strokeWeight`: 1 → 2
- `fontSize`: '10px' → '13px'
- `labelOrigin`: Point(12, 9) → Point(12, 10)

---

### 2. Fix "Aplicar estado de ML"

**Problema**: `estado_ml` almacena valores crudos de ML ("shipped", "delivered") que no son valores validos del enum interno, asi que el boton falla.

**Archivo**: `src/components/shipments/ShipmentDetailsDialog.tsx`

Agregar mapeo ML → interno:
```typescript
const ML_TO_INTERNAL: Record<string, string> = {
  ready_to_ship: 'pendiente',
  shipped: 'en_reparto',
  delivered: 'entregado',
  not_delivered: 'no_entregado',
  cancelled: 'cancelado',
};
```

En `applyMLStatusMutation.mutationFn`: antes de hacer update, mapear `estadoML` via `ML_TO_INTERNAL`. Si no hay mapeo, usar el valor directo (por si ya es un estado interno).

En la UI de estado ML: mostrar el label mapeado si `estado_ml` no esta en `statusConfig`.

**Archivo**: `supabase/functions/mercadolibre-webhook/index.ts`

En las lineas donde se hace `estado_ml: shipment.status`, cambiar a `estado_ml: mapping?.estado_interno || shipment.status` para consistencia.

---

### 3. QR de pedidos ML con datos completos

**Archivo**: `src/components/ecommerce/OrderDetailsDialog.tsx`

En la generacion del QR (linea ~123), enriquecer con `hash_code` y `security_digit` desde `raw_data` si existen. ML diferencia entre direcciones comerciales y residenciales, y el QR oficial incluye estos campos.

---

### 4. Horarios de entrega en el planificador

**Problema**: ML clasifica entregas como "comercial" (con rango horario, ej: 9-18h) o "residencial". El `register-ml-shipment` ya extrae `time_frame` y lo mapea a `horario_preferido_entrega`. Pero el **webhook** no lo hace, y la tabla del planificador no muestra el horario.

**Archivo**: `supabase/functions/mercadolibre-webhook/index.ts`

Al crear el envio (~linea 210), extraer `time_frame` del shipment y calcular `horario_preferido_entrega` igual que en `register-ml-shipment`:
```typescript
const timeFrame = shipment.lead_time?.estimated_delivery_time?.time_frame;
let horarioPreferido = 'cualquier_hora';
if (timeFrame?.from != null && timeFrame?.to != null) {
  if (timeFrame.to <= 13) horarioPreferido = 'manana';
  else if (timeFrame.from >= 17) horarioPreferido = 'noche';
  else if (timeFrame.from >= 12) horarioPreferido = 'tarde';
}
```
Agregar `horario_preferido_entrega: horarioPreferido` al insert de envios.

**Archivo**: `src/pages/RoutePlanner.tsx`

Agregar columna "Horario" en la tabla de envios (despues de "Localidad", ~linea 1522):
```tsx
<TableHead>Horario</TableHead>
```
Y en el body (~linea 1551):
```tsx
<TableCell>
  {envio.horario_preferido_entrega && envio.horario_preferido_entrega !== 'cualquier_hora' && (
    <Badge variant="outline" className="text-[10px]">
      {envio.horario_preferido_entrega === 'manana' ? '🌅 Mañana' :
       envio.horario_preferido_entrega === 'tarde' ? '☀️ Tarde' :
       envio.horario_preferido_entrega === 'noche' ? '🌙 Noche' : ''}
    </Badge>
  )}
</TableCell>
```

---

### Archivos a modificar
1. `src/components/maps/DeliveryStopMarker.tsx` — Escala y fuente del marcador
2. `src/components/shipments/ShipmentDetailsDialog.tsx` — Mapeo ML → interno + fix boton
3. `supabase/functions/mercadolibre-webhook/index.ts` — Consistencia `estado_ml` + extraccion de horarios
4. `src/components/ecommerce/OrderDetailsDialog.tsx` — QR con campos completos
5. `src/pages/RoutePlanner.tsx` — Columna de horario en tabla


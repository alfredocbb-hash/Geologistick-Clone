

# Investigacion y correccion del historial ML para pedidos reprogramados

## Problema detectado

Al revisar el componente `MLShipmentHistorySection` y la edge function `mercadolibre-shipment-history`, se identificaron los siguientes problemas:

1. **No hay logs de la funcion**: la edge function nunca registro actividad, lo que sugiere que puede estar fallando silenciosamente (ej: error de autenticacion, respuesta inesperada de la API de ML).

2. **Formato de respuesta de ML**: La API de MercadoLibre `/shipments/{id}/history` puede devolver los datos bajo una estructura diferente a la esperada. El codigo asume que la respuesta es `{ history: [...] }` directamente, pero ML podria devolverlo como array o bajo otra clave (ej: `status_history`).

3. **Substatuses de reprogramacion no contemplados**: El mapa `ML_STATUS_LABELS` solo cubre estados principales (`pending`, `handling`, `ready_to_ship`, `shipped`, `delivered`, `not_delivered`, `cancelled`). Los substatuses de reprogramacion como `rescheduled`, `rescheduled_by_buyer`, `returning_to_hub`, `second_visit`, etc. no se muestran con etiquetas descriptivas.

## Plan de cambios

### 1. Mejorar la edge function con logging diagnostico

**Archivo**: `supabase/functions/mercadolibre-shipment-history/index.ts`

- Agregar `console.log` al inicio para confirmar que la funcion se ejecuta
- Loguear la respuesta cruda de la API de ML antes de parsearla
- Detectar si la respuesta de ML tiene una estructura diferente (ej: array directo vs objeto con clave)
- Cambiar `getClaims` a `getUser` para consistencia con funciones que si funcionan (como `check-subscription`)

```typescript
// Cambiar autenticacion
const { data: { user }, error: authError } = await supabase.auth.getUser(token);
if (authError || !user) { ... }
const userId = user.id;
```

- Manejar la respuesta de ML de forma flexible:
```typescript
const rawHistory = await historyResponse.json();
console.log('[ML History] Raw response keys:', Object.keys(rawHistory));

// ML puede devolver array directo o bajo una clave
const history = Array.isArray(rawHistory) 
  ? rawHistory 
  : rawHistory.history || rawHistory.status_history || [];
```

### 2. Agregar labels para substatuses de reprogramacion

**Archivo**: `src/components/ecommerce/MLShipmentHistorySection.tsx`

Ampliar `ML_STATUS_LABELS` y agregar un mapa de substatuses para mostrar etiquetas descriptivas:

```typescript
const ML_SUBSTATUS_LABELS: Record<string, string> = {
  rescheduled: 'Reprogramado',
  rescheduled_by_buyer: 'Reprogramado por comprador',
  rescheduled_by_meli: 'Reprogramado por ML',
  returning_to_hub: 'Volviendo a centro',
  second_visit: 'Segunda visita',
  ready_to_print: 'Listo para imprimir',
  printed: 'Etiqueta impresa',
  in_hub: 'En centro de distribucion',
  waiting_for_withdrawal: 'Esperando retiro',
  receiver_absent: 'Destinatario ausente',
  buyer_refused: 'Rechazado por comprador',
};
```

Mostrar el substatus con su label en lugar del valor crudo.

### 3. Mostrar substatus de forma mas visible

En la timeline del historial, cuando el substatus indica reprogramacion, mostrarlo con un badge de color diferente (amarillo/naranja) para que sea visualmente evidente:

```typescript
{event.substatus && (
  <Badge variant="outline" className="text-xs bg-yellow-50 border-yellow-300 text-yellow-700">
    {ML_SUBSTATUS_LABELS[event.substatus] || event.substatus}
  </Badge>
)}
```

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/mercadolibre-shipment-history/index.ts` | Fix auth, logging, manejo flexible de respuesta ML |
| `src/components/ecommerce/MLShipmentHistorySection.tsx` | Labels de substatuses, UI mejorada para reprogramados |

## Sin cambios de base de datos

No se requieren migraciones. Los cambios son en la edge function y en el frontend.


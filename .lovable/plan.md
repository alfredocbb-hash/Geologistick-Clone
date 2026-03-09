

# Fix: Compatibilidad Chrome en formularios con Popover/Select pesados

## Problema

Los usuarios de Chrome experimentan congelamientos o pestañas en blanco al interactuar con selectores (Popover+Command, ContactAutocomplete, Select) principalmente en la página de Nuevo Envío. El fix anterior solucionó el caso de la sucursal destino, pero el mismo patrón de riesgo existe en otros puntos.

## Análisis de áreas vulnerables

Revisé todas las secciones del proyecto. Los problemas de rendimiento en Chrome se concentran en `NewShipment.tsx` (2960 líneas) porque cada `handleChange` → `setFormData` re-renderiza todo el componente, y cuando coincide con el desmontaje de un portal Radix, Chrome se bloquea.

### Puntos problemáticos identificados:

| Componente | Ubicación | Riesgo | Problema |
|------------|-----------|--------|----------|
| **ContactAutocomplete** (x2) | NewShipment L2098, L2266 | Alto | `handleSelect` hace `setOpen(false)` + `onSelect` que dispara `setFormData` con 8+ campos + `setOrigenCoords`/`setDestinoCoords` + toast, todo sincrónicamente |
| **Select tipo_pago cta_cte** | NewShipment L2005 | Alto | `onValueChange` dispara `handleChange` + `handleLoadSenderClient` (que hace otro `setFormData` de 8 campos + `setOrigenCoords` + toast) |
| **AddressAutocomplete** (x2) | NewShipment L2167, L2411 | Medio | `onSelect` dispara `setFormData` + `setOrigenCoords`/`setDestinoCoords`, que cascadea en useEffects de distancia |
| **Select tarifa** | NewShipment L2609 | Medio | `handleChange('tarifa_id')` dispara recálculos de conceptos vía useQuery |
| **Otros Select** (horarios, etc.) | NewShipment | Bajo | Selectores simples con pocos items |
| **Ecommerce Settlements seller popover** | Settlements L1187 | Bajo | Es checkbox, no tiene cascade pesado |

## Solución

Aplicar `requestAnimationFrame` para decoplar el cierre del portal de las actualizaciones de estado en los puntos de alto y medio riesgo:

### 1. ContactAutocomplete.tsx — Defer `onSelect` callback

```typescript
const handleSelect = (client: Client) => {
  setOpen(false);
  setSearch('');
  // Defer parent callback to let Popover portal unmount first
  requestAnimationFrame(() => {
    onSelect(client);
  });
};
```

### 2. NewShipment.tsx — Defer handleLoadSenderClient en Select de Cta Cte (L2005)

Envolver el callback de `onValueChange` del Select de cliente con cuenta corriente para que `handleLoadSenderClient` corra en el siguiente frame.

### 3. NewShipment.tsx — Defer address autocomplete handlers

En `handleRemitenteAddressSelect` y `handleDestinatarioAddressSelect`, las actualizaciones ya son batched por React, pero el `setDestinoCoords`/`setOrigenCoords` separado dispara el `useEffect` de cálculo de distancia. Agrupar coords dentro del mismo `setFormData` no es posible (son estados separados), así que aplicar `requestAnimationFrame` al `setCoords` para que no cascadee inmediatamente.

### 4. NewShipment.tsx — Guard useEffect de auto-tarifa (L699) contra actualizaciones redundantes

Similar al guard que ya aplicamos en L1721, agregar check de igualdad para evitar `setFormData` redundante.

| Archivo | Cambio |
|---------|--------|
| `src/components/shipments/ContactAutocomplete.tsx` | Defer `onSelect` con requestAnimationFrame |
| `src/pages/NewShipment.tsx` | Defer Select cta_cte callback, defer coords en address handlers, guard auto-tarifa useEffect |


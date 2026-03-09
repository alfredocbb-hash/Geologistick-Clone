

# Fix: Chrome no aplica la selección de sucursal hasta cambiar de ventana

## Problema

`requestAnimationFrame` se **pausa** cuando la pestaña de Chrome no está en primer plano o cuando el browser throttlea frames por carga alta. Si el usuario clickea una sucursal y Chrome no ejecuta el siguiente frame inmediatamente (porque el rendering pipeline está ocupado con el desmontaje del Popover), el callback con `setFormData` queda pendiente hasta que algo lo reactive (como cambiar de programa y volver).

## Causa raíz

El fix anterior usó `requestAnimationFrame` para desacoplar el cierre del Popover de las actualizaciones de estado. Pero `requestAnimationFrame` depende del ciclo de renderizado visual del browser, y Chrome puede diferirlo indefinidamente bajo carga.

## Solución

Reemplazar `requestAnimationFrame` por `setTimeout(fn, 0)` en todos los puntos donde se usa para diferir actualizaciones de estado tras cierre de portales. `setTimeout` con delay 0 se ejecuta en el siguiente tick del event loop, independientemente del estado de renderizado.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/NewShipment.tsx` | Reemplazar 4 usos de `requestAnimationFrame` por `setTimeout(fn, 0)` en: selección sucursal destino (L2383), address handlers (L1703, L1716), cta cte handler (L2021) |
| `src/components/shipments/ContactAutocomplete.tsx` | Reemplazar `requestAnimationFrame` por `setTimeout(fn, 0)` en handleSelect (L89) |

### Detalle del cambio

```typescript
// ANTES (puede quedar pendiente en Chrome)
requestAnimationFrame(() => {
  setFormData(prev => ({ ...prev, sucursal_destino_id: s.id }));
});

// DESPUÉS (se ejecuta siempre en el siguiente tick)
setTimeout(() => {
  setFormData(prev => ({ ...prev, sucursal_destino_id: s.id }));
}, 0);
```

Son 5 reemplazos directos de `requestAnimationFrame` → `setTimeout`, sin cambios de lógica.


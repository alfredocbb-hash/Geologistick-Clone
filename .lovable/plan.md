

## Plan: Hacer visible el diálogo de cambio/devolución en la APK

### Problema
Después de confirmar una entrega, el `ExchangeDialog` se activa (`showExchangeDialog = true`) pero el `Dialog` principal de confirmación sigue abierto con `open={true}` (línea 624). Esto hace que el ExchangeDialog quede detrás o tapado por el overlay del Dialog principal, y el chofer nunca lo ve.

### Solución
En `DeliveryConfirmation.tsx`, cambiar la prop `open` del Dialog principal para que se cierre cuando `showExchangeDialog` es `true`:

```tsx
// Antes (línea 624):
<Dialog open onOpenChange={handleClose}>

// Después:
<Dialog open={!showExchangeDialog} onOpenChange={handleClose}>
```

Así, cuando la entrega se confirma y `showExchangeDialog = true`, el Dialog principal se cierra y el ExchangeDialog queda visible al frente.

### Archivos a modificar
| Archivo | Cambio |
|---------|--------|
| `src/components/delivery/DeliveryConfirmation.tsx` | Línea 624: `open={!showExchangeDialog}` |

### Nota sobre la APK
Este cambio es en código web. Como la APK carga desde `dist/`, será necesario reconstruir y sincronizar (`npm run build && npx cap sync`) para que el cambio se refleje en el dispositivo.


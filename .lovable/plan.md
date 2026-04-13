

## Plan: Agregar bloqueo de estados finales en Flex y Flex Mixto

### Problema
En los modos Flex (`FlexScanScreen`) y Flex Mixto (`FlexMixtoScreen`), al escanear un envío que ya está en estado "entregado" o "cancelado", el sistema lo agrega a la lista sin ninguna alerta. Esto difiere del comportamiento del escáner principal (`MobileScanTab` / `ScanQR`) que sí bloquea y avisa.

### Solución
Agregar validación de estados finales en el hook `useFlexPackages`, específicamente en las funciones `addPackage` y `addPackageByTracking`, antes de agregar el paquete a la lista.

### Cambios

#### `src/hooks/useFlexPackages.ts`

1. **En `addPackage(envioId)`** (~línea 273, después de obtener el envío de Supabase):
   - Verificar si `envio.estado` es `'entregado'` o `'cancelado'`
   - Si lo es: mostrar `toast.warning('Este envío ya fue entregado/cancelado')`, reproducir vibración si está disponible, y retornar `null` sin agregarlo a la lista

2. **En `addPackageByTracking(tracking)`** (~línea 346, cuando encuentra el envío):
   - Misma verificación antes de llamar a `addPackage`, o dejar que `addPackage` lo maneje internamente (más limpio)

### Detalle técnico
```typescript
// En addPackage, después de obtener el envío:
const FINAL_STATES = ['entregado', 'cancelado'];
if (FINAL_STATES.includes(envio.estado)) {
  const label = envio.estado === 'entregado' ? 'entregado' : 'cancelado';
  toast.warning(`Este envío ya fue ${label}`, {
    description: envio.tracking_number,
  });
  return null;
}
```

### Archivos a modificar
| Archivo | Cambio |
|---------|--------|
| `src/hooks/useFlexPackages.ts` | Agregar validación de estados finales en `addPackage` |

Un solo cambio en el hook cubre automáticamente Flex, Flex Mixto, y cualquier otro flujo que use `useFlexPackages`.


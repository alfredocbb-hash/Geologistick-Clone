

# Plan: Filtrar tarifas solo por sucursal de origen

## Problema
La lógica actual en `NewShipment.tsx` fusiona tarifas habilitadas del origen **y** del destino. Esto permite que un operador seleccione tarifas del destino que no corresponden a la dirección del envío (como pasó con ENV-MV52PV).

## Cambio

### `src/pages/NewShipment.tsx`

Eliminar la búsqueda bidireccional de tarifas:

1. **Remover** la query `sucursalDestinoTarifas` (líneas ~432-450) y la variable `necesitaBusquedaDestino`
2. **Simplificar** `tarifasDisponibles` (líneas 662-686): usar solo `sucursalTarifas` (origen), sin fusionar con destino
3. **Limpiar** las dependencias del `useMemo` removiendo `sucursalDestinoTarifas` y `necesitaBusquedaDestino`

El resultado: solo se mostrarán las tarifas habilitadas en la sucursal de origen del envío. Si la sucursal origen no tiene tarifas asignadas, se muestran todas (comportamiento actual de fallback).

| Archivo | Cambio |
|---------|--------|
| `src/pages/NewShipment.tsx` | Eliminar fusión bidireccional, usar solo tarifas del origen |


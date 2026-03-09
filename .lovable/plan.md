

# Fix: Chrome freezes/blanks when selecting destination branch in New Shipment

## Problem

When creating a "Sucursal a Sucursal" shipment and selecting a destination branch, Chrome tabs freeze or go blank. This affects some users consistently.

## Root Cause: Cascading state updates in a 2950-line component

Selecting a destination branch triggers a chain reaction of synchronous state updates and re-renders:

```text
User clicks branch
  → handleChange('sucursal_destino_id') [setFormData #1]
  → setSucursalDestinoOpen(false) [Popover portal teardown]
  → useEffect line 1713 fires:
      → setDestinoCoords [state #2]
      → setFormData destinatario_ciudad [state #3]
  → useEffect line 707 fires (auto-tarifa):
      → setFormData tarifa_id [state #4]
  → useEffect line 689 fires (cleanup check)
  → useQuery sucursal-tarifas-destino triggers
  → useEffect line 1729 fires (distance calc → edge function)
  → useQuery tarifa_concepto_precios triggers
```

Each `setFormData` call triggers a full re-render of the 2950-line component. The Radix Popover portal teardown happening simultaneously with 4+ cascading state updates overwhelms Chrome's rendering pipeline.

## Solution

Two changes in `src/pages/NewShipment.tsx`:

### 1. Batch state updates on branch selection

Replace the cascading pattern (select → useEffect → setFormData → useEffect → setFormData) with a single handler that does everything in one update:

```typescript
onSelect={() => {
  // Close popover FIRST via requestAnimationFrame to let portal teardown complete
  setSucursalDestinoOpen(false);
  
  // Then batch all state changes in a single tick
  requestAnimationFrame(() => {
    const sucursalDestino = sucursalesDestino.find(s => s.id === selectedId);
    
    setFormData(prev => ({
      ...prev,
      sucursal_destino_id: selectedId,
      destinatario_ciudad: sucursalDestino?.ciudad || '',
    }));
    
    if (sucursalDestino?.lat && sucursalDestino?.lng) {
      setDestinoCoords({ lat: sucursalDestino.lat, lng: sucursalDestino.lng });
    }
  });
}}
```

### 2. Guard the useEffect at line 1713 to avoid redundant updates

Add a check so the useEffect that syncs `destinatario_ciudad` from the destination branch doesn't re-fire when the value is already correct (since the handler above already sets it):

```typescript
useEffect(() => {
  if (!tieneEntrega && formData.sucursal_destino_id) {
    const sucursalDestino = sucursales.find(s => s.id === formData.sucursal_destino_id);
    if (sucursalDestino) {
      if (sucursalDestino.lat && sucursalDestino.lng) {
        setDestinoCoords({ lat: sucursalDestino.lat, lng: sucursalDestino.lng });
      }
      // Only update if different to avoid cascading re-renders
      const newCiudad = sucursalDestino.ciudad || '';
      setFormData(prev => {
        if (prev.destinatario_ciudad === newCiudad) return prev;
        return { ...prev, destinatario_ciudad: newCiudad };
      });
    }
  }
}, [formData.sucursal_destino_id, sucursales, tieneEntrega]);
```

This reduces 4+ cascading re-renders down to 1-2, and separates the Popover teardown from the state updates so Chrome doesn't choke.

| Archivo | Cambio |
|---------|--------|
| `src/pages/NewShipment.tsx` | Batch branch selection state updates with requestAnimationFrame, guard useEffect against redundant ciudad updates |


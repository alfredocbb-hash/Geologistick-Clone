

# Mostrar nombre de sucursal en ubicación actual del historial

## Problema

La tarjeta "Ubicación actual" muestra "En Sucursal" pero no indica qué sucursal porque solo consulta `sucursal_entrega`. Si ese campo es null (el envío nunca fue transferido), no hay fallback a `sucursal_origen`.

## Cambio

### `src/components/shipments/ShipmentHistoryDialog.tsx` (línea 208)

Agregar fallback: si `sucursal_entrega` es null, usar `sucursal_origen` como ubicación actual:

```tsx
<p className="text-sm font-medium">
  {statusConfig[envioActual.estado as ShipmentStatus]?.label || envioActual.estado}
  {(() => {
    const sucursalNombre = 
      (envioActual.sucursal_entrega as any)?.nombre || 
      (envioActual.sucursal_origen as any)?.nombre;
    return sucursalNombre ? ` — ${sucursalNombre}` : '';
  })()}
</p>
```

Esto muestra:
- La sucursal de entrega si el envío fue transferido/recibido en otra sucursal
- La sucursal de origen como fallback si el envío nunca se movió
- Nada solo si realmente no tiene ninguna sucursal asignada


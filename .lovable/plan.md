

# Mostrar ubicación actual y rutas en el historial del envío

## Problema

El historial muestra los eventos pero falta contexto de **dónde se encuentra actualmente** el envío. La sección "Rutas asociadas" ya está implementada pero solo aparece cuando el envío tiene hojas de ruta o rutas asignadas — si no las tiene, no hay indicador de ubicación.

## Solución

### `src/components/shipments/ShipmentHistoryDialog.tsx`

**1. Agregar query del envío actual** para obtener su estado y ubicación:

```typescript
const { data: envioActual } = useQuery({
  queryKey: ['envio-ubicacion', envioId],
  queryFn: async () => {
    const { data } = await supabase
      .from('envios')
      .select(`
        estado,
        chofer_id,
        sucursal_entrega:sucursales!envios_sucursal_entrega_id_fkey(nombre),
        sucursal_destino:sucursales!envios_sucursal_destino_id_fkey(nombre),
        sucursal_origen:sucursales!envios_sucursal_origen_id_fkey(nombre),
        ciudad_entrega
      `)
      .eq('id', envioId)
      .single();
    
    // Si hay chofer, obtener nombre
    if (data?.chofer_id) {
      const { data: chofer } = await supabase
        .from('profiles')
        .select('nombre, apellido')
        .eq('user_id', data.chofer_id)
        .single();
      return { ...data, chofer };
    }
    return { ...data, chofer: null };
  },
  enabled: open && !!envioId,
});
```

**2. Agregar tarjeta "Ubicación actual"** arriba de la sección de rutas y del timeline:

```tsx
{envioActual && (
  <div className="mb-4 bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1">
    <p className="text-xs font-medium text-muted-foreground uppercase">Ubicación actual</p>
    <div className="flex items-center gap-2">
      <StatusIcon status={envioActual.estado} />
      <div>
        <p className="text-sm font-medium">
          {statusConfig[envioActual.estado]?.label}
          {envioActual.sucursal_entrega?.nombre && ` — ${envioActual.sucursal_entrega.nombre}`}
        </p>
        {envioActual.chofer && (
          <p className="text-xs text-muted-foreground">
            Chofer: {envioActual.chofer.nombre} {envioActual.chofer.apellido}
          </p>
        )}
        {envioActual.sucursal_destino?.nombre && (
          <p className="text-xs text-muted-foreground">
            Destino: {envioActual.sucursal_destino.nombre}
          </p>
        )}
      </div>
    </div>
  </div>
)}
```

Esto muestra siempre dónde está el envío (en qué sucursal, con qué chofer, hacia dónde va) independientemente de si tiene rutas asignadas. La sección "Rutas asociadas" sigue debajo cuando corresponda.


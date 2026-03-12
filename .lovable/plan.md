

# Mostrar destino correcto en tabla de envíos disponibles

## Problema

La columna "Destino" muestra "Sin destino" para envíos con entrega a domicilio porque estos no tienen `sucursal_destino_id`. Sin embargo, sí tienen el campo `ciudad_entrega` con la ciudad de destino ingresada al crear el envío.

## Cambio

### `src/pages/RouteSheets.tsx`

Modificar la celda de "Destino" (líneas 509-514) para usar `ciudad_entrega` como fallback cuando no hay `sucursal_destino_id`:

```tsx
<TableCell>
  {envio.sucursal_destino?.nombre ? (
    <span className="text-sm">{envio.sucursal_destino.nombre}</span>
  ) : envio.ciudad_entrega ? (
    <span className="text-sm">{envio.ciudad_entrega}</span>
  ) : (
    <span className="text-xs text-muted-foreground italic">Sin destino</span>
  )}
</TableCell>
```

Esto mostrará:
- Nombre de la sucursal destino si es envío sucursal-a-sucursal
- Ciudad de entrega si es envío a domicilio
- "Sin destino" solo si realmente no tiene ninguno de los dos


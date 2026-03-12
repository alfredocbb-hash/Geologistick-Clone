

# Mostrar sucursal destino en la tabla de envíos disponibles

## Cambios

### `src/pages/RouteSheets.tsx`

**1. Ampliar la query** (línea 281-284) para incluir la sucursal destino del envío:

```typescript
.select(`
  *,
  destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido),
  sucursal_destino:sucursales!envios_sucursal_destino_id_fkey(nombre, ciudad)
`)
```

**2. Agregar columna "Destino"** en la tabla (líneas 484-509):

- Nuevo `<TableHead>Destino</TableHead>` después de "Destinatario"
- Nuevo `<TableCell>` que muestre `envio.sucursal_destino?.nombre` o un badge "Sin destino" cuando sea null (envíos del modo mixto sin destino asignado)

Esto permitirá al operador identificar rápidamente si cada envío ya tiene destino asignado o necesita que se le asigne al crear la hoja.


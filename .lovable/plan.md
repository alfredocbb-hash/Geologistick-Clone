

# Plan: Agregar columnas de detalle a Pedidos e-Commerce y Gestion de Envios

## Contexto

La imagen de referencia muestra columnas adicionales que facilitan la operativa diaria: Nombre fantasia (seller), IDML (ML shipment ID), Origen, tracking_number, Fecha venta, Fecha BeraExpress, Destino nombre, Destino CP, Zona Entrega, Zona Costo, Chofer, y Estado.

Actualmente ambas tablas muestran informacion basica. Se necesitan columnas adicionales para tener visibilidad operativa completa sin abrir cada registro.

## Cambios propuestos

### 1. Pedidos e-Commerce (`src/pages/ecommerce/Orders.tsx`)

Agregar las siguientes columnas a la tabla existente:

| Columna nueva | Origen del dato |
|---------------|----------------|
| IDML | `order.ml_shipment_id` (ya disponible en el query) |
| Tracking | `order.ml_tracking_number` (ya disponible) |
| Fecha Venta | `order.created_at` (fecha de creacion en ML) |
| Fecha Entrega Est. | `order.fecha_entrega_estimada` (ya se muestra parcialmente) |
| Destino CP | `order.shipping_postal_code` (ya disponible) |
| Chofer | Se obtiene haciendo join del `envio_id` con `envios.chofer_id` y luego con `profiles` |
| Estado envio | Estado del envio interno vinculado |

**Cambios en el query**: Expandir el select para incluir datos del envio vinculado:
```
envio:envios(tracking_number, estado, chofer_id, chofer:profiles!envios_chofer_id_fkey(nombre, apellido))
```

**Columnas en la tabla**: Se reorganizan las columnas para mostrar:
Pedido | Seller | IDML | Tracking | Fecha Venta | Fecha Entrega | Destino | CP | Chofer | Estado | Acciones

### 2. Gestion de Envios (`src/pages/Shipments.tsx`)

Agregar columnas faltantes a la tabla existente:

| Columna nueva | Origen del dato |
|---------------|----------------|
| IDML | `envio.ml_shipment_id` (ya en el query) |
| Chofer | Join con `profiles` via `chofer_id` |
| CP Destino | `envio.codigo_postal_destino` o `envio.cp_entrega` |
| Fecha Entrega | `envio.fecha_entrega` (fecha real de entrega) |

**Cambios en el query**: Expandir el select para incluir el chofer:
```
chofer:profiles!envios_chofer_id_fkey(nombre, apellido)
```

**Columnas en la tabla**: Se reorganizan para mostrar:
Tracking | IDML | Remitente | Destinatario | CP Destino | Origen | Destino | Chofer | Estado | Estado ML | Precio | Fecha | Acciones

## Detalle tecnico

### Orders.tsx - Cambios

1. **Actualizar el query** para incluir datos del envio y chofer:
```typescript
.select(`
  *,
  seller:ecommerce_sellers(id, nombre, tarifa_id, sucursal_pickup_id, tiene_cuenta_corriente),
  envio:envios(tracking_number, estado, chofer_id, 
    chofer:profiles!envios_chofer_id_fkey(nombre, apellido))
`)
```

2. **Actualizar la interfaz Order** para incluir el campo `envio` con su tipo.

3. **Agregar columnas al TableHeader**: IDML, Tracking, Fecha Venta, CP, Chofer.

4. **Renderizar las celdas nuevas** en cada fila con los datos disponibles.

### Shipments.tsx - Cambios

1. **Actualizar el query** para incluir el chofer:
```typescript
.select(`
  *,
  sucursal_origen:sucursales!envios_sucursal_origen_id_fkey(nombre),
  sucursal_destino:sucursales!envios_sucursal_destino_id_fkey(nombre),
  remitente:clientes!envios_remitente_id_fkey(nombre, apellido),
  destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido),
  chofer:profiles!envios_chofer_id_fkey(nombre, apellido)
`)
```

2. **Agregar columnas al TableHeader**: IDML, CP Destino, Chofer.

3. **Renderizar las celdas nuevas** mostrando `ml_shipment_id`, `cp_entrega || codigo_postal_destino`, y el nombre del chofer.

## Archivos afectados

| Archivo | Tipo de cambio |
|---------|---------------|
| `src/pages/ecommerce/Orders.tsx` | Agregar columnas IDML, Tracking, Fecha Venta, CP, Chofer, expandir query |
| `src/pages/Shipments.tsx` | Agregar columnas IDML, CP Destino, Chofer, expandir query |

## Notas

- No se requieren cambios en la base de datos, todos los campos ya existen.
- Las columnas "Zona Entrega" y "Zona Costo" de la imagen de referencia corresponden a la tarifa asociada (`tarifas.zona_origen` / `tarifas.zona_destino`). Se pueden agregar si la tarifa esta vinculada al envio, pero muchos envios no tienen tarifa asignada. Se incluiran solo si el dato esta disponible.
- La tabla puede quedar ancha; se mantiene el scroll horizontal existente del componente Table.


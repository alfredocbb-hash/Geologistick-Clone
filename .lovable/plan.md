

# Corregir nombre de destinatario en PDFs de liquidacion

## Problema

El mismo problema del nombre "-" para envios de Mercado Libre existe en los PDFs descargados desde `src/lib/generateSettlementPDF.ts`. Las funciones `downloadDriverSettlementPDF` y `downloadBranchSettlementPDF` solo buscan el nombre via la relacion con `clientes`, sin usar el fallback a `nombre_destinatario`.

## Cambios en `src/lib/generateSettlementPDF.ts`

### 1. Query de chofer (linea ~258): agregar `nombre_destinatario` al SELECT

```
envio:envios(tracking_number, estado, created_at, precio_total, nombre_destinatario, destinatario_id, 
  clientes:clientes!envios_destinatario_id_fkey(nombre, apellido))
```

### 2. Mapping de chofer (linea ~267): agregar fallback

```typescript
destinatario: c.envio?.clientes 
  ? `${c.envio.clientes.nombre || ''} ${c.envio.clientes.apellido || ''}`.trim() 
  : c.envio?.nombre_destinatario || '-',
```

### 3. Query de sucursal (linea ~315): agregar `nombre_destinatario` al SELECT

```
envio:envios(tracking_number, estado, created_at, nombre_destinatario, destinatario_id, 
  clientes:clientes!envios_destinatario_id_fkey(nombre, apellido))
```

### 4. Mapping de sucursal (linea ~324): agregar fallback

```typescript
destinatario: d.envio?.clientes 
  ? `${d.envio.clientes.nombre || ''} ${d.envio.clientes.apellido || ''}`.trim() 
  : d.envio?.nombre_destinatario || '-',
```

## Resultado

Los PDFs descargados mostraran el nombre del destinatario correctamente para envios manuales (desde tabla clientes) y para envios ML (desde campo nombre_destinatario).

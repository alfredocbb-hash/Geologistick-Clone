## Badge de sincronización con Mercado Libre

Agregar un indicador visual del estado de sincronización con ML en dos ubicaciones: la **lista de envíos** (tabla principal) y el **diálogo de detalle del envío**.

### Componente nuevo: `MLSyncBadge`

Ubicación: `src/components/shipments/MLSyncBadge.tsx`

Recibe como props el envío (o los campos relevantes: `ml_shipment_id`, `ml_sync_status`, `ml_sync_error_detail`, `ml_last_sync_at`).

Lógica de renderizado:
- Si `ml_shipment_id` es `NULL` → no renderiza nada (envío no es de ML).
- Si `ml_sync_status = 'synced'` → badge verde con `CheckCircle2`, texto "ML Sincronizado".
- Si `ml_sync_status = 'pending'` → badge ámbar con `Clock`, texto "ML Pendiente".
- Si `ml_sync_status = 'error'` → badge rojo con `AlertCircle`, texto "Error ML".
- Tooltip (shadcn `Tooltip`) muestra: última sincronización (`ml_last_sync_at` formateado con `date-fns` en español) y, si hay error, el `ml_sync_error_detail`.

### Integraciones

1. **Detalle del envío (admin)**: agregar el badge en `ShipmentDetailDialog.tsx` (o el dialogo equivalente que se use), junto al tracking number / sección de información ML.
2. **Lista de envíos**: agregar el badge en la fila de la tabla principal (`Shipments.tsx` / componente de fila), al lado del tracking, solo visible si el envío es de ML.

### Detalles técnicos

- Usa tokens del design system (no colores hardcodeados): `bg-success/10 text-success border-success/30`, `bg-warning/10 text-warning border-warning/30`, `bg-destructive/10 text-destructive border-destructive/30`. Si algún token no existe, agregarlo en `index.css` + `tailwind.config.ts`.
- Tamaño compacto (`text-xs`, `h-5`, `gap-1`) para que no rompa el layout de la tabla.
- En mobile (vista de lista en APK), el badge se muestra como ícono solo (sin texto) para ahorrar espacio.
- Tooltip con `TooltipProvider` ya existente; en mobile usar `Popover` al tap si Tooltip no se dispara.

### Archivos a tocar

- **Nuevo**: `src/components/shipments/MLSyncBadge.tsx`
- **Editar**: `src/pages/Shipments.tsx` (o el componente de fila/tabla) para incluir el badge en la lista.
- **Editar**: `src/components/shipments/ShipmentDetailDialog.tsx` (o el dialog de detalle correspondiente) para incluirlo en el detalle.
- **Posible edición**: `index.css` / `tailwind.config.ts` si falta el token `success` o `warning`.

### Resultado visual

```text
Tabla:  [ENV-ABC123] [🟢 ML Sincronizado]   Juan Pérez   $1.500
Detalle: Tracking ENV-ABC123  [🟢 ML Sincronizado]  ← hover: "Última sync: hace 2 min"
Error:   [🔴 Error ML]  ← hover: "ML rechazó transición: invalid_status_transition"
```

¿Procedo con la implementación?


# Sistema Dual de Estados (solo para envíos e-commerce)

## Concepto

Agregar una columna `estado_ml` a la tabla `envios` que almacene el estado que reporta Mercado Libre. Esta columna solo se usa para envíos con `ml_shipment_id`. Los envíos normales (sin módulo e-commerce) siguen funcionando exactamente igual, con un solo estado.

Cuando hay discrepancia entre el estado interno y el de ML, se muestra un indicador visual para que el admin decida qué hacer.

## Cambios

### 1. Migración SQL
- Agregar columna `estado_ml` (text, nullable) a `envios`
- Agregar `no_entregado` al enum `shipment_status`
- Agregar mapping `shipped/rescheduled_by_meli` -> `en_transito` en `ml_status_mapping`

### 2. Edge Function `mercadolibre-sync/index.ts`
- Cambiar la sincronización para que solo actualice `estado_ml` (nunca modifique `estado` directamente)
- Agregar segundo paso: buscar envíos con `estado = 'pendiente'` y `ml_shipment_id IS NOT NULL` en la DB, y consultar `/shipments/{id}` para cada uno
- Actualizar `ecommerce_orders.ml_shipping_status` con el status real

### 3. UI en `src/pages/Shipments.tsx`
- Agregar `no_entregado` al `statusConfig`
- Agregar columna "Estado ML" en la tabla, visible **solo** cuando el envío tiene `ml_shipment_id`
- Si no tiene `ml_shipment_id`: celda vacía (envío normal, nada cambia)
- Si hay discrepancia entre `estado` y `estado_ml`: icono de advertencia amarillo

### 4. UI en `src/components/shipments/ShipmentDetailsDialog.tsx`
- Solo para envíos con `ml_shipment_id`: mostrar sección "Estado Mercado Libre" con el valor de `estado_ml`
- Cuando hay discrepancia: botón "Aplicar estado de ML" que copia `estado_ml` a `estado` y registra en historial

## Detalle técnico

### Migración SQL

```sql
ALTER TABLE envios ADD COLUMN IF NOT EXISTS estado_ml text;
ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'no_entregado';
INSERT INTO ml_status_mapping (ml_status, ml_substatus, estado_interno, descripcion)
VALUES ('shipped', 'rescheduled_by_meli', 'en_transito', 'Reprogramado por MercadoLibre')
ON CONFLICT DO NOTHING;
```

### Edge Function: solo actualiza estado_ml

```text
// Antes: actualizaba envios.estado
// Ahora: solo envios.estado_ml
await supabase.from('envios').update({
  estado_ml: newEnvioEstado,
  ml_sync_status: 'synced',
  ml_last_sync_at: new Date().toISOString(),
}).eq('id', existingEnvioId);
```

### Edge Function: segundo paso para pendientes

```text
// Despues de procesar resultados del search API:
const { data: pendingEnvios } = await supabase
  .from('envios')
  .select('id, ml_shipment_id, estado, estado_ml, seller_id')
  .eq('estado', 'pendiente')
  .not('ml_shipment_id', 'is', null);

// Filtrar los que NO fueron procesados en el paso 1
for (const envio of pendingEnvios) {
  if (existingEnviosMap.has(envio.ml_shipment_id)) continue;
  // Consultar /shipments/{id} en ML
  // Actualizar solo estado_ml
  await new Promise(resolve => setTimeout(resolve, 150));
}
```

### UI: columna "Estado ML" (solo si tiene ml_shipment_id)

```text
// En la tabla de envíos:
<TableHead>Estado ML</TableHead>

// En cada fila:
<TableCell>
  {envio.ml_shipment_id ? (
    <div className="flex items-center gap-1">
      <StatusBadge status={envio.estado_ml} />
      {envio.estado_ml !== envio.estado && (
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
      )}
    </div>
  ) : null}
</TableCell>
```

### UI: botón "Aplicar estado ML" en detalles

Solo visible cuando el envío es de ML y hay discrepancia. Al hacer click:
1. Actualiza `envios.estado` con el valor de `estado_ml`
2. Registra el cambio en `envio_historial` con nota "Estado aplicado desde Mercado Libre"
3. Refresca los datos

### statusConfig

```text
no_entregado: { label: 'No Entregado', color: 'bg-red-600', icon: AlertCircle }
```

## Resultado esperado

- Envíos normales (sin e-commerce): todo sigue igual, una sola columna de estado
- Envíos de ML: se ve el estado del sistema Y el estado de ML lado a lado
- Si coinciden: todo normal
- Si no coinciden: triangulo amarillo de advertencia para que el admin tome acción
- El admin puede aplicar el estado de ML con un click, o dejarlo como está

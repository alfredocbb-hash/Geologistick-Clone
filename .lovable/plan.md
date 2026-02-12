

# Sistema Dual de Estados: Estado Interno + Estado ML

## Idea

Agregar una columna `estado_ml` a la tabla `envios` que almacene el estado real de Mercado Libre. De esta forma, el sistema mantiene dos estados independientes:

- **Estado (interno)**: el que maneja el chofer/operador del sistema
- **Estado ML**: el que reporta Mercado Libre directamente

Cuando hay discrepancia (ej: ML dice "entregado" pero el sistema dice "pendiente"), se muestra una alerta visual para que el admin tome acción.

## Cambios

### 1. Migración SQL
- Agregar columna `estado_ml` (text, nullable) a la tabla `envios`
- Agregar `no_entregado` al enum `shipment_status`
- Agregar mapping para `shipped/rescheduled_by_meli` -> `en_transito`

### 2. Edge Function `mercadolibre-sync/index.ts`
- La sincronización ahora SOLO actualiza `estado_ml` (nunca toca `estado` directamente)
- Agregar segundo paso: buscar envíos pendientes con `ml_shipment_id` en la DB y consultar `/shipments/{id}` para cada uno
- Guardar el status real de ML en `estado_ml`
- Actualizar `ecommerce_orders.ml_shipping_status` con el estado real

### 3. UI en `src/pages/Shipments.tsx`
- Agregar columna "Estado ML" en la tabla, visible solo para envíos con `ml_shipment_id`
- Cuando `estado_ml` difiere de `estado`, mostrar un icono de advertencia (triangulo amarillo) que indica discrepancia
- Agregar `no_entregado` al `statusConfig`

### 4. UI en `src/components/shipments/ShipmentDetailsDialog.tsx`
- En la sección de detalles, mostrar ambos estados lado a lado cuando el envío es de ML
- Agregar botón "Sincronizar con ML" para que el admin pueda aplicar el estado de ML al estado interno con un click

## Detalle técnico

### Migración SQL

```sql
ALTER TABLE envios ADD COLUMN IF NOT EXISTS estado_ml text;
ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'no_entregado';
INSERT INTO ml_status_mapping (ml_status, ml_substatus, estado_interno, descripcion)
VALUES ('shipped', 'rescheduled_by_meli', 'en_transito', 'Reprogramado por MercadoLibre')
ON CONFLICT DO NOTHING;
```

### Lógica de sincronización (mercadolibre-sync)

```text
// Antes: actualizaba envios.estado directamente
// Ahora: solo actualiza envios.estado_ml
await supabase.from('envios').update({
  estado_ml: newEnvioEstado,  // estado mapeado desde ML
  ml_sync_status: 'synced',
  updated_at: new Date().toISOString(),
}).eq('id', existingEnvioId);

// Segundo paso: envíos pendientes no encontrados en search
const { data: pendingEnvios } = await supabase
  .from('envios')
  .select('id, ml_shipment_id, estado, estado_ml')
  .eq('estado', 'pendiente')
  .not('ml_shipment_id', 'is', null);

for (const envio of pendingEnvios) {
  // Consultar /shipments/{id} en ML
  // Actualizar solo estado_ml
}
```

### UI - Columna de Estado ML en la tabla

En la tabla de envíos, agregar una columna que muestre:
- Si el envío NO es de ML: celda vacía
- Si el envío es de ML y los estados coinciden: badge del estado ML
- Si hay discrepancia: badge del estado ML + icono de advertencia amarillo

### UI - Botón "Aplicar estado ML" en el detalle

En el dialog de detalles, cuando hay discrepancia:
- Mostrar ambos estados lado a lado
- Botón "Aplicar estado de ML" que copia `estado_ml` a `estado` y registra en historial
- Botón "Notificar al chofer" (futuro, por ahora solo el de aplicar)

### statusConfig actualizado

```text
no_entregado: { label: 'No Entregado', color: 'bg-red-600', icon: AlertCircle }
```

## Resultado esperado

- La sincronización ya no toca el estado interno, solo guarda lo que dice ML en `estado_ml`
- El admin ve ambos estados y decide si aplicar el de ML o no
- Se eliminan los problemas de "retroceso" de estados porque ML ya no cambia el estado interno
- Los envíos que están pendientes en el sistema pero entregados en ML se detectan visualmente

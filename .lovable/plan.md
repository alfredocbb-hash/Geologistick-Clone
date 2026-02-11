

## Problema Detectado

Los pedidos de Kingdom Vintage aparecen como **pendientes** y con tracking del sistema (`94A-ENV-...`) en lugar del tracking nativo de MercadoLibre (`ML-{shipment_id}`).

### Causa Raiz

1. **Estado Pendiente**: Es correcto. ML reporta estos pedidos como `ready_to_ship`, lo cual se mapea a "Pendiente" en el sistema. Significa que estan listos para ser recogidos.

2. **Tracking incorrecto**: La funcion backend `mercadolibre-sync` fue actualizada en el codigo para usar `ML-{shipment_id}` como tracking, pero la version desplegada en produccion todavia usa la funcion `generate_tracking_number()` del sistema. Esto afecta a **22 envios** creados desde el 10 de febrero en adelante.

## Plan de Correccion

### Paso 1: Redesplegar la funcion de sincronizacion
Asegurar que la funcion `mercadolibre-sync` se despliegue con el codigo actual que genera tracking `ML-{id}`.

### Paso 2: Corregir tracking existentes
Actualizar los 22 envios que tienen tracking `94A-ENV-...` pero tienen `ml_shipment_id`, cambiandoles el tracking a `ML-{ml_shipment_id}`:

```sql
UPDATE envios 
SET tracking_number = 'ML-' || ml_shipment_id::TEXT
WHERE ml_shipment_id IS NOT NULL 
AND tracking_number NOT LIKE 'ML-%';
```

Tambien actualizar los `ecommerce_orders` correspondientes:

```sql
UPDATE ecommerce_orders 
SET ml_tracking_number = 'ML-' || eo.ml_shipment_id::TEXT
FROM (
  SELECT id, ml_shipment_id FROM ecommerce_orders 
  WHERE ml_tracking_number IS NULL AND ml_shipment_id IS NOT NULL
) eo
WHERE ecommerce_orders.id = eo.id;
```

### Paso 3: Verificacion
Confirmar que no quedan envios ML con tracking del sistema.

## Detalle Tecnico

- **Archivos**: No se requieren cambios de codigo (el codigo ya esta correcto)
- **Funcion a redesplegar**: `mercadolibre-sync`
- **Registros afectados**: 22 envios en tabla `envios`
- **Riesgo**: Bajo. Solo cambia el identificador visual, no afecta la logica de negocio ni la sincronizacion con ML

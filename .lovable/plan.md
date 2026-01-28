
# Plan: Sincronizar Estados entre Envíos y Pedidos E-commerce

## Problema Identificado

Los pedidos e-commerce muestran "Pendiente" en la columna "Estado" aunque los envíos asociados ya están en estados avanzados (recogido, en_reparto, entregado).

**Datos actuales en la base de datos:**
| Pedido | order_status | fulfillment_status | envio_id |
|--------|-------------|-------------------|----------|
| #100 | pending | shipped | Creado |
| #101 | pending | processing | Creado |
| #102 | pending | shipped | Creado |

## Causa Raíz

No existe sincronización entre el estado del `envios` y el `ecommerce_orders`. Los únicos momentos donde se actualiza `ecommerce_orders` son:
1. Al crear el envío → `fulfillment_status: 'processing'`
2. Cuando `tiendanube-fulfill` tiene éxito → `fulfillment_status: 'fulfilled'`

Pero nunca se actualiza `order_status` ni `fulfillment_status` cuando el estado del envío cambia (recogido → en_reparto → entregado).

## Solución Propuesta

Crear un **trigger de base de datos** que sincronice automáticamente los estados cuando el campo `estado` de `envios` cambia.

### Mapeo de Estados

| Estado Envío | order_status | fulfillment_status |
|-------------|-------------|-------------------|
| pendiente | (sin cambio) | pending |
| recogido | (sin cambio) | processing |
| en_bodega | (sin cambio) | processing |
| en_transito | (sin cambio) | shipped |
| en_reparto | shipped | shipped |
| entregado | delivered | delivered |
| devuelto | (sin cambio) | pending |
| cancelado | cancelled | pending |

### Implementación

**1. Crear función de sincronización:**

```sql
CREATE OR REPLACE FUNCTION sync_ecommerce_order_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo procesar si el estado cambió
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    -- Buscar si existe un pedido e-commerce vinculado
    UPDATE ecommerce_orders
    SET
      fulfillment_status = CASE NEW.estado
        WHEN 'pendiente' THEN 'pending'
        WHEN 'recogido' THEN 'processing'
        WHEN 'en_bodega' THEN 'processing'
        WHEN 'en_transito' THEN 'shipped'
        WHEN 'en_reparto' THEN 'shipped'
        WHEN 'entregado' THEN 'delivered'
        WHEN 'devuelto' THEN 'pending'
        WHEN 'cancelado' THEN 'pending'
        ELSE fulfillment_status
      END,
      order_status = CASE NEW.estado
        WHEN 'en_reparto' THEN 'shipped'
        WHEN 'entregado' THEN 'delivered'
        WHEN 'cancelado' THEN 'cancelled'
        ELSE order_status
      END,
      updated_at = now()
    WHERE envio_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**2. Crear el trigger:**

```sql
CREATE TRIGGER on_envio_estado_change_sync_ecommerce
AFTER UPDATE ON envios
FOR EACH ROW
EXECUTE FUNCTION sync_ecommerce_order_status();
```

**3. Actualizar pedidos existentes (one-time fix):**

```sql
UPDATE ecommerce_orders eo
SET
  fulfillment_status = CASE e.estado
    WHEN 'pendiente' THEN 'pending'
    WHEN 'recogido' THEN 'processing'
    WHEN 'en_bodega' THEN 'processing'
    WHEN 'en_transito' THEN 'shipped'
    WHEN 'en_reparto' THEN 'shipped'
    WHEN 'entregado' THEN 'delivered'
    ELSE eo.fulfillment_status
  END,
  order_status = CASE e.estado
    WHEN 'en_reparto' THEN 'shipped'
    WHEN 'entregado' THEN 'delivered'
    WHEN 'cancelado' THEN 'cancelled'
    ELSE eo.order_status
  END,
  updated_at = now()
FROM envios e
WHERE eo.envio_id = e.id
AND eo.envio_id IS NOT NULL;
```

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| Nueva migración SQL | Crear función + trigger + actualizar datos existentes |

## Beneficios

1. **Automático**: Los estados se sincronizan sin intervención manual
2. **Consistente**: No importa dónde cambie el estado del envío
3. **Retrocompatible**: No afecta la lógica existente de Tiendanube

## Riesgo y Complejidad

- **Riesgo**: Bajo - Solo escribe en `ecommerce_orders` cuando ya existe vínculo
- **Impacto**: Alto - Resuelve inconsistencias de datos
- **Tiempo estimado**: 15 minutos

## Verificación Post-Implementación

1. Confirmar que los pedidos #100, #101, #102 ahora muestran estados correctos
2. Crear un nuevo envío desde pedido → verificar que `fulfillment_status` = 'processing'
3. Confirmar retiro → verificar que cambia a 'processing' o 'shipped'
4. Confirmar entrega → verificar que cambia a 'delivered'

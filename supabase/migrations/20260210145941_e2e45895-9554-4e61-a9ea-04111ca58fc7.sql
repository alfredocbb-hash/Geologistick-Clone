
-- 1. Agregar cliente_id a ecommerce_sellers
ALTER TABLE ecommerce_sellers ADD COLUMN cliente_id uuid REFERENCES clientes(id);

-- 2. Fix retroactivo: poner nombre_remitente en envios ML existentes
UPDATE envios e
SET nombre_remitente = s.nombre
FROM ecommerce_orders eo
JOIN ecommerce_sellers s ON eo.seller_id = s.id
WHERE eo.envio_id = e.id
  AND e.nombre_remitente IS NULL
  AND e.ml_shipment_id IS NOT NULL;

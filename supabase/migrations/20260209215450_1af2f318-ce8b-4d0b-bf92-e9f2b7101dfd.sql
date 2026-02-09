-- Fix existing ML orders with total = 0 by recalculating from items JSONB
UPDATE ecommerce_orders 
SET total = (
  SELECT COALESCE(SUM((item->>'unit_price')::numeric * (item->>'quantity')::numeric), 0)
  FROM jsonb_array_elements(items::jsonb) AS item
),
updated_at = now()
WHERE plataforma = 'mercadolibre' 
  AND (total = 0 OR total IS NULL) 
  AND items IS NOT NULL 
  AND items::text != '[]';
-- RLS policy for seller_cuenta_corriente: Sellers can view their own movements
CREATE POLICY "Seller ve sus movimientos" ON seller_cuenta_corriente
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM ecommerce_sellers es
    WHERE es.id = seller_cuenta_corriente.seller_id
    AND es.user_id = auth.uid()
  )
);

-- Sellers can also insert withdrawal requests
CREATE POLICY "Seller puede solicitar retiro" ON seller_cuenta_corriente
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM ecommerce_sellers es
    WHERE es.id = seller_cuenta_corriente.seller_id
    AND es.user_id = auth.uid()
  )
  AND tipo = 'solicitud_retiro'
);
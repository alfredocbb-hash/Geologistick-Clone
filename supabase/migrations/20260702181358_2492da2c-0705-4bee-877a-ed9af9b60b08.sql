INSERT INTO ml_status_mapping (ml_status, ml_substatus, estado_interno, descripcion) VALUES
  ('shipped', 'refused_delivery', 'no_entregado', 'Entrega rechazada por comprador'),
  ('shipped', 'printed', 'pendiente', 'Etiqueta impresa, listo para despacho'),
  ('shipped', 'ready_to_print', 'pendiente', 'Listo para imprimir etiqueta'),
  ('ready_to_ship', 'printed', 'pendiente', 'Etiqueta impresa'),
  ('ready_to_ship', 'ready_to_print', 'pendiente', 'Listo para imprimir'),
  ('delivered', 'address_mismatch', 'entregado', 'Entregado con corrección de dirección'),
  ('cancelled', 'fraudulent', 'cancelado', 'Cancelado por fraude')
ON CONFLICT (ml_status, ml_substatus) DO UPDATE 
  SET estado_interno = EXCLUDED.estado_interno,
      descripcion = EXCLUDED.descripcion;

UPDATE envios 
SET estado = 'no_entregado'
WHERE ml_substatus_actual = 'refused_delivery' AND estado = 'en_reparto';

INSERT INTO envio_historial (envio_id, estado_anterior, estado_nuevo, notas)
SELECT id, 'en_reparto', 'no_entregado', 'Reconciliado con ML: refused_delivery'
FROM envios WHERE ml_substatus_actual = 'refused_delivery' AND estado = 'no_entregado'
  AND NOT EXISTS (SELECT 1 FROM envio_historial h WHERE h.envio_id = envios.id AND h.notas LIKE '%refused_delivery%');
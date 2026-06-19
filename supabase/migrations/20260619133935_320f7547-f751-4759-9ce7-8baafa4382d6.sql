
-- 1) Nuevos mapeos para shipped + substatus que no existían
INSERT INTO public.ml_status_mapping (ml_status, ml_substatus, estado_interno, descripcion) VALUES
  ('shipped','receiver_absent','primera_visita','Destinatario ausente (1ra visita)'),
  ('shipped','returning_to_hub','en_transito','Volviendo al centro de distribución'),
  ('shipped','returning_to_sender','devuelto','Volviendo al remitente'),
  ('shipped','buyer_refused','no_entregado','Rechazado por comprador'),
  ('shipped','damaged','incidencia','Paquete dañado'),
  ('shipped','stolen','incidencia','Paquete robado'),
  ('shipped','lost','incidencia','Paquete extraviado'),
  ('shipped','waiting_for_withdrawal','en_sucursal','Esperando retiro en sucursal'),
  ('shipped','in_hub','en_sucursal','En centro de distribución')
ON CONFLICT (ml_status, ml_substatus) DO NOTHING;

-- 2) Resincronización de envíos existentes con substatus ML que no estaban reflejados
-- 2a) receiver_absent / second_visit -> primera_visita o segunda_visita
WITH candidatos AS (
  SELECT e.id, e.estado, e.reprogramado_count, e.ml_substatus_actual,
    EXISTS (
      SELECT 1 FROM public.envio_historial h
      WHERE h.envio_id = e.id AND h.estado_nuevo = 'primera_visita'
    ) AS ya_tuvo_primera
  FROM public.envios e
  WHERE e.ml_shipment_id IS NOT NULL
    AND e.ml_substatus_actual IN ('receiver_absent','second_visit')
    AND e.estado NOT IN ('entregado','cancelado','devuelto','no_entregado','primera_visita','segunda_visita')
),
updated AS (
  UPDATE public.envios e
  SET estado = (
    CASE 
      WHEN c.ml_substatus_actual = 'second_visit' THEN 'segunda_visita'::shipment_status
      WHEN c.ya_tuvo_primera OR COALESCE(c.reprogramado_count,0) >= 1 THEN 'segunda_visita'::shipment_status
      ELSE 'primera_visita'::shipment_status
    END
  ),
  estado_ml = (
    CASE 
      WHEN c.ml_substatus_actual = 'second_visit' THEN 'segunda_visita'
      WHEN c.ya_tuvo_primera OR COALESCE(c.reprogramado_count,0) >= 1 THEN 'segunda_visita'
      ELSE 'primera_visita'
    END
  )
  FROM candidatos c
  WHERE e.id = c.id
  RETURNING e.id, c.estado AS estado_anterior, e.estado AS estado_nuevo, c.ml_substatus_actual
)
INSERT INTO public.envio_historial (envio_id, estado_anterior, estado_nuevo, notas, ubicacion)
SELECT id, estado_anterior, estado_nuevo,
  'Resincronización subestados ML [' || ml_substatus_actual || ']',
  'ML Resync'
FROM updated;

-- 2b) returning_to_hub -> en_transito
WITH cand AS (
  SELECT id, estado FROM public.envios
  WHERE ml_shipment_id IS NOT NULL AND ml_substatus_actual = 'returning_to_hub'
    AND estado NOT IN ('entregado','cancelado','devuelto','no_entregado','en_transito')
),
upd AS (
  UPDATE public.envios e SET estado='en_transito'::shipment_status, estado_ml='en_transito'
  FROM cand WHERE e.id = cand.id
  RETURNING e.id, cand.estado AS estado_anterior
)
INSERT INTO public.envio_historial (envio_id, estado_anterior, estado_nuevo, notas, ubicacion)
SELECT id, estado_anterior, 'en_transito'::shipment_status, 'Resincronización subestados ML [returning_to_hub]', 'ML Resync'
FROM upd;

-- 2c) returning_to_sender -> devuelto
WITH cand AS (
  SELECT id, estado FROM public.envios
  WHERE ml_shipment_id IS NOT NULL AND ml_substatus_actual = 'returning_to_sender'
    AND estado NOT IN ('entregado','cancelado','devuelto')
),
upd AS (
  UPDATE public.envios e SET estado='devuelto'::shipment_status, estado_ml='devuelto'
  FROM cand WHERE e.id = cand.id
  RETURNING e.id, cand.estado AS estado_anterior
)
INSERT INTO public.envio_historial (envio_id, estado_anterior, estado_nuevo, notas, ubicacion)
SELECT id, estado_anterior, 'devuelto'::shipment_status, 'Resincronización subestados ML [returning_to_sender]', 'ML Resync'
FROM upd;

-- 2d) waiting_for_withdrawal / in_hub -> en_sucursal
WITH cand AS (
  SELECT id, estado, ml_substatus_actual FROM public.envios
  WHERE ml_shipment_id IS NOT NULL 
    AND ml_substatus_actual IN ('waiting_for_withdrawal','in_hub')
    AND estado NOT IN ('entregado','cancelado','devuelto','no_entregado','en_sucursal')
),
upd AS (
  UPDATE public.envios e SET estado='en_sucursal'::shipment_status, estado_ml='en_sucursal'
  FROM cand WHERE e.id = cand.id
  RETURNING e.id, cand.estado AS estado_anterior, cand.ml_substatus_actual
)
INSERT INTO public.envio_historial (envio_id, estado_anterior, estado_nuevo, notas, ubicacion)
SELECT id, estado_anterior, 'en_sucursal'::shipment_status, 
  'Resincronización subestados ML [' || ml_substatus_actual || ']', 'ML Resync'
FROM upd;

-- 2e) buyer_refused -> no_entregado
WITH cand AS (
  SELECT id, estado FROM public.envios
  WHERE ml_shipment_id IS NOT NULL AND ml_substatus_actual = 'buyer_refused'
    AND estado NOT IN ('entregado','cancelado','devuelto','no_entregado')
),
upd AS (
  UPDATE public.envios e SET estado='no_entregado'::shipment_status, estado_ml='no_entregado'
  FROM cand WHERE e.id = cand.id
  RETURNING e.id, cand.estado AS estado_anterior
)
INSERT INTO public.envio_historial (envio_id, estado_anterior, estado_nuevo, notas, ubicacion)
SELECT id, estado_anterior, 'no_entregado'::shipment_status, 'Resincronización subestados ML [buyer_refused]', 'ML Resync'
FROM upd;

-- 2f) damaged / stolen / lost -> incidencia
WITH cand AS (
  SELECT id, estado, ml_substatus_actual FROM public.envios
  WHERE ml_shipment_id IS NOT NULL 
    AND ml_substatus_actual IN ('damaged','stolen','lost')
    AND estado NOT IN ('entregado','cancelado','devuelto','incidencia')
),
upd AS (
  UPDATE public.envios e SET estado='incidencia'::shipment_status, estado_ml='incidencia'
  FROM cand WHERE e.id = cand.id
  RETURNING e.id, cand.estado AS estado_anterior, cand.ml_substatus_actual
)
INSERT INTO public.envio_historial (envio_id, estado_anterior, estado_nuevo, notas, ubicacion)
SELECT id, estado_anterior, 'incidencia'::shipment_status, 
  'Resincronización subestados ML [' || ml_substatus_actual || ']', 'ML Resync'
FROM upd;

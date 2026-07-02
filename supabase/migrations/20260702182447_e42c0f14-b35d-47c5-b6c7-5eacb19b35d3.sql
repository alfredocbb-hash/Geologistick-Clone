DO $$
DECLARE
  v_ids text[] := ARRAY['47422160200','47422485457','47423083475','47423658271','47424039681','47424729662','47425134738','47425567253','47426184108','47427083017','47427837943','47428476037','47428595551'];
  v_envio RECORD;
BEGIN
  FOR v_envio IN
    SELECT id, estado FROM envios WHERE ml_shipment_id::text = ANY(v_ids) AND estado = 'pendiente'
  LOOP
    UPDATE envios
      SET estado = 'en_reparto',
          ml_substatus_actual = 'out_for_delivery',
          ml_sync_status = 'synced',
          updated_at = now()
      WHERE id = v_envio.id;

    INSERT INTO envio_historial (envio_id, estado_anterior, estado_nuevo, notas)
    VALUES (v_envio.id, v_envio.estado, 'en_reparto',
            'Reconciliación manual: escaneado físicamente + ML shipped/out_for_delivery');
  END LOOP;
END $$;
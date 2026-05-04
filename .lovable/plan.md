## Objetivo

Pasar a estado `entregado` los **32 envíos** del tenant **Beraexpress** (`94a9ea85-43c5-49ac-9bfa-86843072c2ce`) que actualmente están en estado `en_reparto`, manteniendo al chofer asignado como responsable de la entrega.

## Datos verificados

- Tenant: **Beraexpress** (slug `vos-lo-vendes-y-nosotros-lo-entregamos`)
- Envíos `en_reparto`: **32**
- Todos tienen chofer asignado (32/32)
- Ninguno tiene pago contra entrega (COD = 0), así que no hay cobros que registrar
- Todos fueron asignados el 2026-04-27

## Cambio a aplicar

Operación de **datos puntual** (una sola vez, no automatizada) sobre la tabla `envios`:

- `estado` = `'entregado'`
- `fecha_entrega` = `NOW()` (si está nula, el trigger `set_fecha_entrega_on_delivered` ya lo cubre)
- `entregado_en_sucursal` = `false` (entrega en domicilio, atribuida al chofer)
- `chofer_id` se mantiene → cuenta para liquidaciones del repartidor
- `updated_at` = `NOW()`

Filtros estrictos:
```sql
WHERE tenant_id = '94a9ea85-43c5-49ac-9bfa-86843072c2ce'
  AND estado = 'en_reparto'
```

## Efectos automáticos (triggers existentes)

Al cambiar `estado → entregado` se disparan automáticamente:

1. **`log_envio_estado_change`** → inserta una entrada en `envio_historial` por cada envío con la nota "Entregado en domicilio" y el chofer.
2. **`auto_sync_ml_status`** → para los envíos que sean de Mercado Libre, sincroniza el estado contra ML vía edge function.
3. **`sync_partner_shipment_status`** → si alguno fue derivado a un partner, propaga el `entregado` al envío origen.
4. **`set_fecha_entrega_on_delivered`** → completa `fecha_entrega` si quedó nula.

No se tocan pagos, rendiciones ni cajas (no hay COD en este lote).

## Reversibilidad

Una vez aplicado, los envíos quedan en estado final. Solo un `super_admin` podrá revertir individualmente vía el diálogo de cambio de estado. Por eso, antes de ejecutar, te voy a pedir confirmación final.

## Pasos

1. Ejecutar el `UPDATE` masivo filtrado por tenant + estado.
2. Verificar el conteo final (`SELECT COUNT(*) ... estado='entregado' AND fecha_entrega >= hoy`) y reportarlo.
3. Confirmarte cuántos historiales se generaron y si hubo envíos ML re-sincronizados.

¿Avanzo con la ejecución?

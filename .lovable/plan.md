## Actualización masiva: "en reparto" → "entregado"

### Alcance
Marcar como **entregado** los **183 envíos** actualmente en estado `en_reparto`, manteniendo su chofer asignado (`chofer_id`) como responsable de la entrega.

Distribución por chofer:
- Chofer A (`9bed0e1c…`): 103 envíos
- Chofer B (`d6a5a65d…`): 64 envíos
- Chofer C (`cd2d5aab…`): 10 envíos
- Chofer D (`06e22285…`): 6 envíos

Total: **183 envíos** en un único tenant activo.

### Acciones

1. **UPDATE masivo** sobre `envios`:
   - `estado = 'entregado'`
   - `fecha_entrega = NOW()` (donde sea NULL — el trigger `set_fecha_entrega_on_delivered` también lo cubre)
   - Filtro: `estado = 'en_reparto'`
   - Se preserva `chofer_id` existente (no se modifica)

2. **Efectos automáticos** (vía triggers existentes, no requiere acción manual):
   - `log_envio_estado_change` → registra entrada en `envio_historial` por cada envío con la transición `en_reparto → entregado`.
   - `set_fecha_entrega_on_delivered` → asegura `fecha_entrega` en NOW().
   - `sync_partner_shipment_status` → propaga estado a envíos partner si aplica.
   - `auto_sync_ml_status` → encola sincronización con Mercado Libre para envíos ML.

3. **Paradas de ruta**: actualizar `ruta_paradas` correspondientes que estén `pendiente` para esos envíos a `completada` con `completada_at = NOW()`, evitando inconsistencias en rutas en curso.

### Consideraciones
- No se generan automáticamente registros de pago COD (`pagos`) — solo se cambia el estado. Si se requiere registrar cobranza COD, debe hacerse aparte.
- La operación es irreversible salvo intervención manual de un super_admin.

### Confirmación requerida
¿Procedo a ejecutar el UPDATE masivo sobre los 183 envíos del tenant activo?
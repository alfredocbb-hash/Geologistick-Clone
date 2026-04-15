

## Plan: Actualizar envíos en_reparto de Beraexpress a entregado

### Datos encontrados
- **Tenant**: Beraexpress (`94a9ea85-...`)
- **Envíos en_reparto**: ~20+ envíos
- **Choferes asignados**: Kevin Bernard y Fernando Mauro (ya asignados, se mantienen)

### Acción
Ejecutar un UPDATE via insert tool:

```sql
UPDATE envios
SET estado = 'entregado',
    fecha_entrega = now(),
    updated_at = now()
WHERE estado = 'en_reparto'
  AND tenant_id = '94a9ea85-43c5-49ac-9bfa-86843072c2ce';
```

### Qué pasa automáticamente
- El trigger `log_envio_estado_change` crea registro en `envio_historial` con las notas descriptivas ("Entregado en domicilio - Entregó: chofer")
- El trigger `sync_ecommerce_order_status` actualiza órdenes ecommerce vinculadas
- El trigger `auto_sync_ml_status` sincroniza con MercadoLibre si son envíos ML
- El `chofer_id` existente se mantiene, por lo que queda registrado como que lo entregó el chofer asignado

### No se requieren cambios de código
Solo es una operación de datos.


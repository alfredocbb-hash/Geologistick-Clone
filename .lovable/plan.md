

## Plan: Asignar sucursal Mar del Plata a 7 envíos

### Acción
Ejecutar un UPDATE vía la herramienta de inserción para asignar `sucursal_entrega_id = '53aa8cf8-660e-45f0-b4b8-3316520090cc'` (MAR DEL PLATA) a los 7 envíos.

- Los 6 entregados quedarán vinculados a la sucursal para que figuren en la liquidación
- ENV-JK3MTE se mantiene cancelado pero también recibe la sucursal

### SQL a ejecutar
```sql
UPDATE envios
SET sucursal_entrega_id = '53aa8cf8-660e-45f0-b4b8-3316520090cc',
    updated_at = now()
WHERE tracking_number IN ('ENV-3PLUEN', 'ENV-AVMNDU', 'ENV-JK3MTE', 'ENV-7MWMQG', 'ENV-HEG7AV', 'ENV-UEGYVU', 'ENV-YFRT7X');
```

### Impacto
- Sin cambios de código
- Los 6 envíos entregados aparecerán en la liquidación de la sucursal Mar del Plata
- ENV-JK3MTE seguirá cancelado (no se incluye en liquidaciones por su estado)


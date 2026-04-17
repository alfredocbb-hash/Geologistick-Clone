
Actualizar `fecha_entrega` del envío 1564 a hoy a las 22:35 hs (hora Argentina).

## Acción
UPDATE en `envios` (id `85aa726f-8e23-4e82-a38f-c2e0c62287ed`) seteando `fecha_entrega` con el timestamp correspondiente a las 22:35 hora Argentina (UTC-3) → `01:35 UTC` del día siguiente.

## SQL
```sql
UPDATE envios
SET fecha_entrega = (date_trunc('day', fecha_entrega AT TIME ZONE 'America/Argentina/Buenos_Aires')
                     + interval '22 hours 35 minutes') AT TIME ZONE 'America/Argentina/Buenos_Aires',
    updated_at = now()
WHERE id = '85aa726f-8e23-4e82-a38f-c2e0c62287ed';
```

Esto preserva el día original de entrega y solo cambia la hora a 22:35 ART. El EPOD reflejará la nueva hora automáticamente.

## Riesgo
Bajo. Cambio puntual de un campo de un solo envío.

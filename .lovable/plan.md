

## Plan: Re-sincronizar horarios de entrega para envíos ML existentes

### Problema
Hay **116 envíos ML activos** sin horario de entrega (`horario_entrega_desde`, `horario_entrega_hasta` son NULL). Estos fueron creados antes de que la función de sync extrajera el `time_frame`.

### Solución
Crear una edge function `recover-ml-timeframes` que:
1. Busque envíos ML activos sin horario de entrega
2. Para cada uno, consulte la API de ML (`/shipments/{id}`) usando el access token del seller correspondiente
3. Extraiga `lead_time.estimated_delivery_time.time_frame`
4. Actualice los campos `horario_entrega_desde`, `horario_entrega_hasta` y `horario_preferido_entrega`

### Archivo a crear

| Archivo | Descripción |
|---------|-------------|
| `supabase/functions/recover-ml-timeframes/index.ts` | Edge function que re-consulta ML y actualiza horarios |

### Flujo
1. Recibe POST con `tenant_id` (o lo obtiene del usuario autenticado)
2. Busca sellers ML del tenant con access token válido
3. Busca envíos sin horario vinculados a cada seller (via `ecommerce_orders`)
4. Para cada envío, llama a `/shipments/{ml_shipment_id}` de ML
5. Extrae `time_frame` y actualiza el envío en la DB
6. Retorna conteo de actualizados/errores

### Ejecución
Una vez creada, la invocaré directamente para actualizar los 116 envíos del tenant `94a9ea85-43c5-49ac-9bfa-86843072c2ce`.

### Detalle técnico
- Reutiliza la función `getValidAccessToken` del sync existente
- Agrupa envíos por seller para usar un solo token por seller
- Procesa en lotes para no exceder rate limits de ML


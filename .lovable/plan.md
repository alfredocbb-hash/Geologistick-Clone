

## Plan: Agregar rango horario exacto de entrega en el planificador

### Problema
Actualmente solo se guarda `horario_preferido_entrega` como texto genérico ("manana", "tarde", "noche"), pero ML provee el rango exacto (ej: 09:00-20:30 para comercial). No hay columnas en la DB para ese rango y el planificador solo muestra la franja genérica.

### Cambios

**1. Migración de base de datos** — Agregar 2 columnas a `envios`:
```sql
ALTER TABLE public.envios 
  ADD COLUMN horario_entrega_desde text,
  ADD COLUMN horario_entrega_hasta text;
```

**2. Edge Functions** — Guardar el rango exacto al crear envíos desde ML:
- `supabase/functions/register-ml-shipment/index.ts`: extraer `time_frame.from` y `time_frame.to`, convertir a formato "HH:MM", y guardar en `horario_entrega_desde` / `horario_entrega_hasta`.
- `supabase/functions/mercadolibre-webhook/index.ts`: mismo cambio al procesar webhooks.

**3. Formulario de nuevo envío** (`src/pages/NewShipment.tsx`):
- Agregar campos opcionales "Desde" y "Hasta" (inputs tipo time) cuando se selecciona un horario preferido, para que el usuario pueda ingresar el rango manualmente también.

**4. Planificador** (`src/pages/RoutePlanner.tsx`):
- En la columna "Horario", mostrar el rango exacto si existe (ej: "09:00 - 20:30"), y debajo/al lado la franja genérica como badge secundario.
- Incluir los nuevos campos en la query de envíos.

### Archivos a modificar
- **Migración SQL** — Agregar columnas `horario_entrega_desde` y `horario_entrega_hasta`
- `supabase/functions/register-ml-shipment/index.ts` — Persistir rango horario de ML
- `supabase/functions/mercadolibre-webhook/index.ts` — Persistir rango horario de ML
- `src/pages/RoutePlanner.tsx` — Mostrar rango horario en columna "Horario"
- `src/pages/NewShipment.tsx` — Campos opcionales para rango horario manual



## Problema

Cuando Google Places devuelve una dirección de CABA, el campo `locality` es siempre **"Buenos Aires"** (o "Ciudad Autónoma de Buenos Aires"). El barrio real (Palermo, Villa Crespo, Villa del Parque, etc.) viene en `sublocality_level_1` / `neighborhood`. Hoy `AddressAutocomplete.tsx` sólo lee `locality`, por lo que todos los envíos de CABA quedan con ciudad "Buenos Aires".

## Cambios propuestos

### 1. Autocomplete: preferir barrio para CABA (`src/components/maps/AddressAutocomplete.tsx`)

Al extraer los `address_components`:

- Capturar también `sublocality_level_1`, `sublocality`, `neighborhood` y `administrative_area_level_2`.
- Regla nueva para el campo `city`:
  - Si `administrative_area_level_1` es "Ciudad Autónoma de Buenos Aires" (o `locality` == "Buenos Aires" con CP que empiece en `C`/`1`): usar `sublocality_level_1` → `sublocality` → `neighborhood` como ciudad, en ese orden.
  - Caso contrario: mantener `locality` actual, con fallback a `administrative_area_level_2`.
- Si el barrio devuelto por Google viene distinto al del CP (rara vez), priorizar Google y dejar el CP como está.

### 2. Fallback por código postal (nuevo helper `src/lib/cabaBarriosByCP.ts`)

Tabla de mapeo CP CABA → barrio (los 48 barrios oficiales). Se usa cuando:
- La dirección se ingresa manualmente sin autocomplete.
- Google no devolvió `sublocality_level_1` pero el CP empieza con `C1` o `1` y cae en CABA.

El helper expone `getBarrioByCP(cp: string): string | null`.

Se llama desde `AddressAutocomplete` como último fallback, y se expone para que el resto del sistema (OCR, edición manual) también lo pueda usar.

### 3. Aplicar la misma lógica en el resto de puntos de entrada

- `src/lib/ocrParser.ts`: cuando el OCR detecte CP de CABA y ciudad = "Buenos Aires"/"CABA"/"Capital Federal", reemplazar por el barrio del helper.
- `src/components/routes/EditShipmentLocationDialog.tsx`: ya usa `AddressAutocomplete`, hereda el fix automáticamente.
- Edge function `supabase/functions/geocode-address/index.ts`: aplicar la misma preferencia de `sublocality_level_1` sobre `locality` en CABA (para geocode server-side usado en imports/ML).

### 4. Backfill de datos históricos

Migración one-shot que actualiza envíos existentes donde `ciudad_entrega` ∈ {"Buenos Aires","CABA","Capital Federal","Ciudad Autónoma de Buenos Aires"} y `cp_entrega` está poblado:

```sql
UPDATE envios
SET ciudad_entrega = <barrio del CP>
WHERE ciudad_entrega ILIKE ANY (ARRAY['buenos aires','caba','capital federal','ciudad aut%'])
  AND cp_entrega IS NOT NULL
  AND <CP matchea alguno de los del mapa>;
```

Se hace vía función PL/pgSQL con `CASE` sobre los prefijos de CP (C1000..C1499 y equivalentes numéricos). Misma actualización en `ciudad_retiro`/`cp_retiro`. Se registra un `envio_historial` opcional? — por defecto NO, para no ensuciar el historial con un cambio administrativo.

### 5. Verificación

- Probar en `/shipments/new` con las direcciones del screenshot (Av. Las Heras 2900 → Palermo/Recoleta; Villa Crespo; Villa del Parque).
- Confirmar que envíos ya cargados en Buenos Aires quedan reasignados a su barrio correcto post-migración.

## Fuera de alcance

- No se toca la lógica de tarifas por ciudad (las reglas por "Buenos Aires" existentes seguirán matcheando por provincia/CP si están configuradas así; si un tenant tenía tarifas por barrio, el cambio las hará matchear mejor).
- No se agregan barrios de GBA ni de otras ciudades grandes en esta iteración; sólo CABA. Si más adelante hace falta La Plata, Rosario, Córdoba capital, se extiende el helper.

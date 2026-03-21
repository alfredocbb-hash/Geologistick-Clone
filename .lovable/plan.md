

## Plan: Auto-selección de tarifa por destino en API pública

### Problema
Actualmente `public-rates` devuelve **todas** las tarifas activas del tenant. Debería replicar la lógica de `NewShipment.tsx` → `encontrarTarifaPorDestino()`: matchear por `zona_destino` (ciudad o CP) y devolver **una sola tarifa** (o las que coincidan con el destino).

### Cambio

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/public-rates/index.ts` | Agregar campo `zona_destino, rangos_kg` al SELECT de tarifas; filtrar con lógica de matching por destino antes de calcular precios |

### Lógica de matching (misma que NewShipment)

1. Fetch tarifas con campo adicional `zona_destino` y `rangos_kg`
2. Si `ciudad_destino` o `cp_destino` están presentes:
   - Normalizar texto (lowercase, sin acentos)
   - Filtrar tarifas cuya `zona_destino` (CSV) contenga la ciudad o CP
   - Si hay múltiples coincidencias y `peso > 0`, desempatar por `rangos_kg`
   - Si queda una sola → devolver solo esa
3. Si no hay `ciudad_destino` ni `cp_destino` → devolver todas (comportamiento actual, fallback)

### Resultado esperado

Con `cp_destino=1884` y `ciudad_destino=Berazategui`:
- Solo devuelve la tarifa cuya `zona_destino` incluya "Berazategui" o "1884"
- En vez de las 4 tarifas actuales, devuelve 1 resultado


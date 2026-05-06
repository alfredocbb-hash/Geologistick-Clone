## Problema

La URL `https://geologistick.com/tracking?q=44056` no funciona por dos razones:

1. **Parámetro incorrecto**: La página `/tracking` solo lee `?code=...` desde `useSearchParams`, ignora `?q=...` (y otros alias como `?tracking=`). El input queda vacío y nunca se dispara la búsqueda.
2. **Bloqueo de códigos cortos**: Aunque el usuario reescriba el código en el input, el edge function `public-tracking` rechaza cualquier código de menos de 8 caracteres si no hay API key (`"Full tracking number required for public access"`). El envío `44056` existe en la base como `tracking_number = '44056'` (5 caracteres), por lo que nunca se encuentra públicamente.
3. **Falta búsqueda por `tracking_externo`**: Si en el futuro el tracking se carga en `tracking_externo` (caso ML/partners), tampoco lo encuentra.

## Cambios propuestos

### 1. `src/pages/Tracking.tsx`
- Aceptar como alias del query param `code`: `q`, `tracking`, `t`. Usar el primero que esté presente.
- Mantener compatibilidad con `code` y con la ruta `/tracking/:code`.

### 2. `supabase/functions/public-tracking/index.ts`
- Permitir **match exacto** sin importar la longitud para usuarios no autenticados (es decir: `44056` es válido si coincide exacto con `tracking_number` o con `tracking_externo`). El bloqueo anti-enumeración por longitud solo aplicará al modo "suffix" (`%code`).
- Lógica nueva:
  - Intento 1: `eq('tracking_number', code)` o `eq('tracking_externo', code)` (case-insensitive vía `or` con `ilike` exacto).
  - Intento 2 (solo si `code.length >= 8` y no se encontró): suffix match `ilike %code` sobre `tracking_number`.
- Mantener la restricción de tenant cuando hay API key.

### 3. Visualización
- Asegurar que en la respuesta y la UI se siga priorizando `tracking_externo || tracking_number` (regla global ya existente).

## Verificación
- `https://geologistick.com/tracking?q=44056` → carga el envío `44056` (estado actual `en_reparto`).
- `https://geologistick.com/tracking?code=44056` y `/tracking/44056` siguen funcionando.
- Códigos cortos aleatorios inexistentes devuelven 404 (no enumeración masiva, porque solo se permite match exacto, no suffix).
- Códigos con `tracking_externo` (ej. ML) también se encuentran.

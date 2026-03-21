

## Diagnóstico: Diferencia de precio entre Horizon y NewShipment

### Causa raíz

Hay **2 diferencias críticas** en la lógica de `public-rates` vs `NewShipment`:

1. **`encontrarTarifaPorDestino` devuelve TODAS las tarifas en lugar de UNA sola**
   - En `NewShipment` (línea 177): si no hay match → retorna `null` (no se cobra)
   - En `public-rates` (línea 47): si no hay match → retorna TODAS las tarifas activas
   - Si hay match, `NewShipment` retorna la MEJOR (1 sola), `public-rates` retorna TODAS las que coinciden
   - **Resultado**: Horizon puede estar sumando conceptos de múltiples tarifas o mostrando la tarifa incorrecta

2. **Conceptos básicos vs adicionales no diferenciados**
   - En `NewShipment`: solo suma `es_basico = true` automáticamente. Los adicionales (`es_basico = false`) requieren selección manual del operador
   - En `public-rates`: suma TODOS los conceptos (básicos + adicionales) sin distinción → precio inflado
   - **Resultado**: $11.650 en Horizon vs $9.250 en el sistema (la diferencia son conceptos adicionales que no deberían sumarse automáticamente)

### Cambio propuesto

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/public-rates/index.ts` | Corregir lógica para igualar NewShipment |

### Correcciones específicas

1. **`encontrarTarifaPorDestino`**: Cambiar para que retorne UNA sola tarifa (la mejor coincidencia), igual que NewShipment. Si no hay match, no devolver tarifas.

2. **Filtro de conceptos**: Solo sumar conceptos con `es_basico = true` (o `es_basico IS NULL` como fallback). Los adicionales NO se suman — se pueden listar aparte en la respuesta para que Horizon los muestre como opcionales.

3. **Respuesta enriquecida**: Separar en la respuesta:
   ```json
   {
     "rates": [{
       "tarifa": "ENVIOS GENERAL",
       "precio": 9250,
       "conceptos_incluidos": [...],
       "conceptos_opcionales": [...]
     }]
   }
   ```

Esto garantiza que el precio de la API coincida exactamente con el que calcula el sistema al crear un envío.




## Plan: Agregar soporte de dimensiones (largo, ancho, alto) a la API public-rates

### Problema actual

La API `public-rates` no acepta parámetros de dimensiones. En el sistema administrativo (`NewShipment`), si alguna dimensión del paquete supera el `umbral_volumen_cm` de la tarifa y hay `precio_por_m3` configurado, se aplica un cobro por volumen que tiene **prioridad** sobre el cálculo por peso. La API ignora esto completamente.

### Cambio propuesto

**Archivo:** `supabase/functions/public-rates/index.ts`

1. **Nuevos parámetros de entrada**: Aceptar `largo`, `ancho`, `alto` (en cm, opcionales)

2. **Agregar campos a la consulta de tarifas**: Incluir `precio_por_m3`, `umbral_volumen_cm` y `rangos_precios` en el SELECT de tarifas

3. **Lógica de volumen (prioridad máxima)**: Antes del cálculo por peso, verificar:
   - `tipo_tarifa === 'peso'` y las 3 dimensiones están presentes
   - Alguna dimensión supera `umbral_volumen_cm` (default 50)
   - `precio_por_m3 > 0`
   - Si aplica: `flete = precioBase + (volumen_m3 × precio_por_m3)`
   - `metodo = 'volumen_excedido'`

4. **Respuesta enriquecida**: Si se aplicó volumen, incluir detalle en el rate:
   ```json
   {
     "metodo": "volumen_excedido",
     "detalle_volumen": {
       "dimensiones_cm": { "largo": 80, "ancho": 60, "alto": 40 },
       "volumen_m3": 0.192,
       "umbral_cm": 50
     }
   }
   ```

### Ejemplo de uso para Horizon

```json
POST /functions/v1/public-rates
{
  "peso": 5,
  "largo": 80,
  "ancho": 60,
  "alto": 40,
  "ciudad_origen": "Berazategui",
  "ciudad_destino": "Burzaco",
  "tipo_servicio": "sucursal_puerta"
}
```

Si alguna dimensión (80cm) supera el umbral (50cm), el precio se calcula por volumen en lugar de por peso.




## Plan: Corregir cálculo de tarifas en `public-rates` para igualar lógica de `NewShipment`

### Problemas identificados

1. **`rangos_kg` ignorados**: El endpoint no usa los rangos escalonados de peso (prioridad 1 en NewShipment). Solo usa `rangos_precios` (base + adicional por kg), lo que da precios incorrectos.
2. **Concepto "Flete" no sumado al flete base**: NewShipment suma el monto del concepto con código "flete" al flete calculado. El endpoint no lo hace.
3. **Porcentaje por bulto extra no aplicado**: Cuando `multiplicar_flete_por_bultos = false` y hay más de 1 bulto, NewShipment aplica `porcentaje_flete_bulto`. El endpoint no.
4. **Conceptos porcentuales no soportados**: NewShipment soporta conceptos con `es_porcentaje = true` que calculan sobre el valor declarado. El endpoint solo usa `monto` fijo.
5. **`pickup_points` sin datos completos para "sucursal a sucursal"**: Los pickup points ya se devuelven, pero falta el `id` de la sucursal para que Horizon pueda mostrar un selector.
6. **Auto-resolución no devuelve ciudad en `resolucion`**: Cuando se resuelve desde CP, la ciudad resuelta sí se devuelve (ya implementado), pero si no se resuelve, no se incluye contexto.

### Cambio

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/public-rates/index.ts` | Alinear lógica de cálculo con NewShipment |

### Detalle de la corrección del cálculo

Se reescribirá el bloque de cálculo de precio (líneas ~322-381) para seguir esta jerarquía:

1. **Rangos escalonados (`rangos_kg`)** — si el peso cae en un rango, usar ese precio directamente
2. **Método simple (`rangos_precios`)** — base + adicional por kg excedente  
3. **Fallback** — precio base

Después del flete base:
- Sumar concepto "flete" (código = "flete") al flete
- Aplicar multiplicación por bultos O porcentaje por bulto extra
- Sumar conceptos básicos (excluyendo "flete"), soportando `es_porcentaje` y `multiplicar_por_bultos`
- Sumar conceptos de entrega/retiro según tipo de servicio
- Sumar seguro

Adicionalmente:
- Agregar `porcentaje_flete_bulto` al SELECT de tarifas
- Agregar `es_porcentaje, porcentaje, multiplicar_por_bultos, activo` al SELECT de conceptos
- Agregar `id` a los pickup_points para que Horizon pueda usarlos en un selector
- Filtrar conceptos inactivos (`activo = false`)


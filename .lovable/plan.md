

# Fix: Envíos manuales con fecha_entrega NULL no aparecen en liquidaciones

## Problema detectado

El envío `ADMIN-ENV-20260223-A4B450` es un envío manual (sin orden e-commerce) vinculado al seller Kingdom Vintage a través de `remitente_id`. Al calcular la liquidación del período 21/02 al 28/02, este envío no aparece porque:

- No tiene `ecommerce_order` asociada, por lo que no entra por el flujo de órdenes (que filtra por `fecha_entrega_estimada` de la orden).
- Entra por el flujo de "envíos comunes" (por `remitente_id`), pero este flujo filtra por `fecha_entrega` y el envío tiene `fecha_entrega = NULL`.

## Solución

Modificar la query de envíos comunes en `src/pages/ecommerce/Settlements.tsx` para que, cuando `fecha_entrega` sea NULL, use `created_at` como alternativa de filtrado.

Dado que el cliente de Supabase no soporta condiciones OR complejas nativamente, la solución es hacer **dos queries** y combinar resultados sin duplicados:

1. Query original: envíos comunes filtrados por `fecha_entrega` en el rango
2. Query adicional: envíos comunes donde `fecha_entrega IS NULL`, filtrados por `created_at` en el rango

Luego se combinan ambos conjuntos, eliminando duplicados por `id`.

## Cambios

| Archivo | Lineas | Descripcion |
|---|---|---|
| `src/pages/ecommerce/Settlements.tsx` | ~418-445 | Agregar segunda query para envíos con `fecha_entrega` NULL filtrados por `created_at`, combinar con la query existente |

### Detalle tecnico

En la mutacion `calculateMutation`, despues de la query existente de `commonEnvios` (linea 418-425), agregar:

```text
// Query adicional: envios sin fecha_entrega, filtrados por created_at
const { data: commonEnviosNoDate } = await supabase
  .from('envios')
  .select('id, tracking_number, nombre_destinatario, ...')
  .in('remitente_id', uniqueOnlyClienteIds)
  .is('fecha_entrega', null)
  .gte('created_at', fechaInicioStr)
  .lte('created_at', fechaFinStr)
  .is('liquidacion_seller_id', null)
  .order('created_at', { ascending: true });

// Combinar sin duplicados
const commonEnvioIds = new Set((commonEnvios || []).map(e => e.id));
const mergedCommonEnvios = [
  ...(commonEnvios || []),
  ...(commonEnviosNoDate || []).filter(e => !commonEnvioIds.has(e.id))
];
```

Luego usar `mergedCommonEnvios` en lugar de `commonEnvios` en el filtrado posterior (linea 430).

No se requieren cambios en la base de datos.

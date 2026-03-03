

# Plan: Excluir envíos "pago destino" de liquidaciones terciarizadas

## Problema
La consulta de cálculo en `ThirdPartySettlements.tsx` (línea 181-188) trae todos los envíos entregados de la empresa terciarizada sin filtrar por tipo de pago. Los envíos con `tipo_pago = 'destino'` no deberían incluirse porque el pago lo realiza el destinatario, no la empresa terciarizada.

## Solución

### Modificar: `src/pages/ThirdPartySettlements.tsx`
En la función `handleCalculate()` (línea ~181), agregar un filtro `.neq('tipo_pago', 'destino')` a la consulta de Supabase para excluir los envíos con pago destino:

```typescript
const { data, error } = await supabase
  .from("envios")
  .select("id, tracking_number, tracking_externo, nombre_destinatario, precio_total, fecha_entrega")
  .eq("empresa_terciarizada_id", liqEmpresaId)
  .eq("es_terciarizado", true)
  .eq("estado", "entregado")
  .neq("tipo_pago", "destino")  // ← agregar esta línea
  .gte("fecha_entrega", periodoInicio)
  .lte("fecha_entrega", periodoFin + "T23:59:59");
```

Es un cambio de una sola línea. No requiere cambios en el backend ni en otras páginas.


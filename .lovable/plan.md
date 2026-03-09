

# Fix: Nombre destinatario no aparece en envíos comunes de liquidaciones

## Problema

La query trae correctamente el join `destinatario:clientes(nombre, apellido)`, y la UI lo usa como fallback (línea 1370). Pero al mapear los resultados a `CalculatedEnvio` (líneas 670-683), el campo `destinatario` no se incluye en el objeto mapeado, por lo que siempre es `undefined` en la tabla.

## Cambio

### `src/pages/ecommerce/Settlements.tsx` — línea 682

Agregar `destinatario: e.destinatario` al objeto de retorno del mapeo (entre `tiene_visitas` y el cierre del objeto):

```typescript
return {
  id: e.id,
  tracking_number: e.tracking_number,
  nombre_destinatario: e.nombre_destinatario,
  direccion_entrega: e.direccion_entrega,
  ciudad_entrega: e.ciudad_entrega,
  precio_total: precioFinal,
  precio_original: e.precio_total || 0,
  precio_calculado: precioCalculado,
  zona_match: zonaMatch,
  estado: e.estado,
  created_at: e.created_at,
  tiene_visitas: tieneVisitas,
  destinatario: e.destinatario || null,  // ← línea faltante
};
```

Es un cambio de una sola línea. La interfaz `CalculatedEnvio` ya tiene el campo y la UI ya lo usa como fallback.


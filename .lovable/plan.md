

# Fix: Envíos ML pendientes aparecen en el Planificador

## Problema

Los envíos de Mercado Libre en estado `pendiente` (listos para enviar, no recolectados) aparecen en el Planificador de Rutas cuando no deberían.

**Causa raíz**: La consulta que obtiene los IDs de envíos de e-commerce (línea 259-262 de `RoutePlanner.tsx`) no tiene límite explícito, y Supabase aplica un máximo de 1000 filas por defecto. Como hay **1117 registros** en `ecommerce_orders` con `envio_id`, los envíos más recientes quedan fuera del Set y pasan el filtro como si no fueran de e-commerce.

## Solución

**Archivo: `src/pages/RoutePlanner.tsx`** (líneas ~259-266)

Cambiar la estrategia de filtrado: en vez de traer TODOS los `ecommerce_orders` (que ya superó el límite de 1000), invertir la lógica para que el filtro revise directamente si el envío tiene `ml_shipment_id` y está en estado `pendiente`, lo cual es más robusto y no depende de una segunda consulta.

Reemplazar:
1. Eliminar la consulta a `ecommerce_orders` (líneas 258-266)
2. Simplificar el filtro (líneas 270-278): excluir envíos que tengan `ml_shipment_id` Y estén en estado `pendiente`, excepto si vienen del URL o tienen historial de reprogramación

La nueva lógica sería:
```
const filtered = merged.filter(envio => {
  // Si viene del URL, siempre mostrar
  if (urlEnvioIds.has(envio.id)) return true;
  // Si tiene reprogramaciones, mostrar
  if ((envio.reprogramado_count && envio.reprogramado_count > 0) || envio.ultima_reprogramacion) return true;
  // Si es ML y está pendiente, ocultar (aún no recolectado)
  if (envio.ml_shipment_id && envio.estado === 'pendiente') return false;
  // Resto: mostrar
  return true;
});
```

Esto es más simple, más eficiente (elimina una query), y no tiene el problema del límite de 1000 filas.


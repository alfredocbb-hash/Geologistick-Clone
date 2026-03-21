

## Plan: Auto-resolver localidad/CP en la API de cotización

### Objetivo
Cuando el usuario envía solo `cp_origen` (sin `ciudad_origen`) o viceversa, la API auto-completa el campo faltante usando la tabla `sucursales` del tenant. Lo mismo para destino, usando `sucursal_zonas`.

### Cambios

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/public-rates/index.ts` | Auto-resolver ciudad↔CP para origen y destino; incluir datos resueltos en la respuesta |
| `src/pages/TenantApiDocs.tsx` | Documentar el comportamiento de auto-resolución |

### Lógica de resolución

**Origen** (usa tabla `sucursales`):
1. Si viene `cp_origen` pero no `ciudad_origen` → buscar sucursal por CP, usar su `ciudad`
2. Si viene `ciudad_origen` pero no `cp_origen` → buscar sucursal por ciudad, usar su `codigo_postal`
3. Si vienen ambos → usar tal cual (comportamiento actual)

**Destino** (usa tabla `sucursal_zonas`):
1. Si viene `cp_destino` pero no `ciudad_destino` → buscar en `sucursal_zonas` del tenant una zona cuyo rango de CP contenga el CP dado, usar su `ciudad`
2. Si viene `ciudad_destino` pero no `cp_destino` → buscar zona por ciudad, usar su CP
3. Si vienen ambos → usar tal cual

### Respuesta enriquecida
Agregar al response un objeto `resolucion` con los valores resueltos:
```json
{
  "rates": [...],
  "pickup_points": [...],
  "resolucion": {
    "origen": { "ciudad": "Mar del Plata", "codigo_postal": "7600", "sucursal": "Mar del Plata Centro" },
    "destino": { "ciudad": "Berazategui", "codigo_postal": "1884" }
  }
}
```

Esto permite al consumidor de la API verificar qué se resolvió automáticamente.

### Detalle técnico

En el bloque de filtrado por origen (líneas ~141-174), cambiar el `select("id")` a `select("id, ciudad, codigo_postal, nombre")` y usar los valores para enriquecer `ciudadOrigen`/`cpOrigen` si faltaban.

Para destino, agregar una query a `sucursal_zonas` cuando falte ciudad o CP:
```sql
SELECT ciudad, codigo_postal_desde 
FROM sucursal_zonas 
WHERE tenant_id = tenantId AND activa = true
  AND (ciudad ILIKE '%destino%' OR cp_destino BETWEEN codigo_postal_desde AND codigo_postal_hasta)
```


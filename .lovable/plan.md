

## Plan: Agregar origen a la API de cotización para filtrar tarifas por sucursal

### Problema
Actualmente `public-rates` filtra tarifas solo por destino, pero en `NewShipment` también se restringe a las tarifas habilitadas en la **sucursal de origen** (vía `sucursal_tarifas`). Sin ese filtro, la API puede devolver tarifas que no corresponden al punto de despacho.

### Solución
Agregar parámetros opcionales de origen (`cp_origen`, `ciudad_origen`) al endpoint. Con ellos, se busca la sucursal más cercana del tenant y se filtran las tarifas solo a las habilitadas en esa sucursal (tabla `sucursal_tarifas`).

### Cambios

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/public-rates/index.ts` | Agregar params `cp_origen` y `ciudad_origen`; filtrar tarifas por `sucursal_tarifas` de la sucursal que matchee el origen |
| `src/pages/TenantApiDocs.tsx` | Actualizar documentación del endpoint con los nuevos parámetros |

### Lógica

1. Parsear `cp_origen` y `ciudad_origen` del request
2. Si se proporcionan, buscar en `sucursales` del tenant la que coincida por CP o ciudad
3. Si se encuentra una sucursal origen, consultar `sucursal_tarifas` para obtener las tarifas habilitadas (`habilitada = true`)
4. Intersectar esas tarifas con las activas antes de aplicar el filtro de destino
5. Si no se proporcionan parámetros de origen, comportamiento actual (todas las tarifas activas)

### Request actualizado

```json
{
  "peso": 5,
  "bultos": 1,
  "cp_origen": "7600",
  "ciudad_origen": "Mar del Plata",
  "cp_destino": "1884",
  "ciudad_destino": "Berazategui",
  "tipo_servicio": "sucursal_sucursal",
  "valor_declarado": 40000
}
```

### Resultado esperado
Con origen "Mar del Plata" y destino "Berazategui", solo devuelve la tarifa que esté habilitada en la sucursal de Mar del Plata Y cuya zona_destino incluya Berazategui — idealmente 1 sola tarifa.


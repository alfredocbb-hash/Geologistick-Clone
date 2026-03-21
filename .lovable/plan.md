

## Plan: Corregir endpoint `public-branches`

### Problemas encontrados

1. **Error en query** (visible en logs): `column sucursales.codigo_postal does not exist` — la tabla `sucursales` NO tiene columna `codigo_postal`, pero la función la incluye en el SELECT y en el response.
2. **404 en curl**: la función necesita redespliegue tras corregir el código.

### Columnas reales de `sucursales`
`nombre, codigo, direccion, ciudad, telefono, email, lat, lng, horario_apertura, horario_cierre, permite_retiro_clientes, puede_despachar, realiza_entregas, activa, tenant_id, ...`

No existe `codigo_postal`.

### Cambio

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/public-branches/index.ts` | Eliminar `codigo_postal` del SELECT y del mapeo de respuesta |

### Detalle
- Línea 47: quitar `codigo_postal` del `.select()`
- Líneas 72-73: quitar `codigo_postal: s.codigo_postal` del mapeo de resultado

La función se redesplegará automáticamente y quedará operativa.


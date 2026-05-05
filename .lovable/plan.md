## Diagnóstico

En `/settlements/third-party` el cálculo no devuelve envíos por dos razones:

1. La query filtra `tipo_pago != 'destino'`. De los 183 envíos terciarizados entregados, **63 tienen `tipo_pago` NULL** (son terciarizados sin clasificar) — el filtro `.neq('tipo_pago', 'destino')` los descarta porque `NEQ` no matchea NULL en Postgres/PostgREST. **Hay que cambiarlo a `.or('tipo_pago.is.null,tipo_pago.neq.destino')`**.

2. La mayoría de envíos terciarizados **tiene `precio_total = 0`** (ver Lace, Alvarez F, etc.) porque hoy no hay forma de tarifar el servicio que la empresa terciarizada le presta a la nuestra. Aunque se incluyan en la liquidación, salen con $0.

Además el usuario pide poder asignar **tarifas a empresas terciarizadas** para que el costo del flete terciarizado se calcule automáticamente.

## Solución

### A. Modelo de tarifas para terciarizados (nuevo)

Crear tabla `tarifas_terciarizadas`:

```
id uuid PK
empresa_id uuid FK -> empresas_terciarizadas
tenant_id uuid
nombre text                       -- ej. "CABA y GBA", "Interior"
tipo_tarifa text                  -- 'fija' | 'por_zona' | 'por_kg'
precio_fijo numeric               -- si 'fija': se aplica a cualquier envío
zonas jsonb                       -- si 'por_zona': [{ ciudades: [...], provincias: [...], precio: N }]
precio_por_kg numeric             -- si 'por_kg'
precio_minimo numeric             -- piso
activa boolean default true
created_at, updated_at
```

RLS: por `tenant_id` (admin/super_admin del tenant).

Resolver precio de un envío terciarizado:
1. Buscar tarifas activas de la empresa.
2. Si `por_zona`: matchear `ciudad_entrega` (o `ciudad_retiro` si `requiere_retiro`) primero exacto, luego substring, luego provincia.
3. Si `fija`: usar `precio_fijo` directamente.
4. Si `por_kg`: `precio_por_kg * peso` con piso `precio_minimo`.

### B. UI para gestionar tarifas terciarizadas

En `src/pages/ThirdPartyCompanies.tsx`, agregar acción "Tarifas" en cada empresa que abre un nuevo dialog `ThirdPartyRatesDialog`:

- Lista de tarifas de la empresa (CRUD).
- Form con tipo, precio fijo, editor de zonas (ciudades + precio), peso.
- Estado activo.

### C. Fix del cálculo de liquidación

En `src/pages/ThirdPartySettlements.tsx` (`handleCalculate`):

1. Cambiar el filtro `tipo_pago`:
   ```
   .or('tipo_pago.is.null,tipo_pago.neq.destino')
   ```
2. Quitar dependencia de `precio_total`. Para cada envío:
   - Si `precio_total > 0` → usar ese.
   - Si no → resolver precio aplicando tarifas de la empresa (helper nuevo `resolveTerciarizadoPrice(envio, tarifas)`).
   - Si no hay tarifa que matchee → mostrar el envío con `precio_resuelto = 0` y un badge "Sin tarifa" para que el usuario lo vea y pueda configurar.
3. Mostrar columna nueva con el precio resuelto y permitir edición manual antes de generar la liquidación (similar a las liquidaciones de seller).
4. Al generar la liquidación, `liquidacion_terciarizado_detalles.monto` se guarda con el precio resuelto/editado, no `precio_total` del envío.

### D. Detalles de UX

- En el detalle de empresa terciarizada agregar tab "Tarifas".
- En el dialog de generación de liquidación, footer con "X envíos sin tarifa configurada — configurar ahora" (link a la pantalla).
- Si todas las tarifas de la empresa están desactivadas o no hay ninguna, mostrar warning antes de calcular.

## Archivos a tocar

- Nueva migración SQL: tabla `tarifas_terciarizadas` + RLS + índice por `empresa_id`.
- Nuevo `src/components/settlements/ThirdPartyRatesDialog.tsx`.
- Nuevo `src/lib/resolveTerciarizadoPrice.ts` (motor de matching).
- `src/pages/ThirdPartyCompanies.tsx` — botón "Tarifas" + integrar dialog.
- `src/pages/ThirdPartySettlements.tsx` — fix filtro `tipo_pago`, integrar resolver, columna precio editable, persistir monto al generar.

## Resumen

Crear sistema de tarifas para empresas terciarizadas (tabla + UI), arreglar el filtro de `tipo_pago` que oculta envíos con NULL, y resolver dinámicamente el precio de cada envío terciarizado al liquidar usando esas tarifas.
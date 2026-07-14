
## Contexto

El backfill dejó los envíos CABA con la ciudad del barrio (Palermo, Belgrano, Villa Crespo, etc.) en lugar de "Buenos Aires". Todos los motores de matching por ciudad de las liquidaciones y tarifas siguen comparando texto plano, por lo que:

- Un chofer con regla de zona configurada como "Buenos Aires" / "CABA" / "Capital Federal" **ya no matchea** contra un envío cuya ciudad ahora es "Palermo".
- Las tarifas por zona (`tarifas.zona_destino`) configuradas con "CABA" tampoco matchean, y se cae al fallback por provincia (o a 0).
- Las tarifas de terciarizados (`tarifas_terciarizadas.zonas`) tienen el mismo problema.
- Público (`public-rates`) y creación desde ML devuelven precio 0 / sin tarifa.
- La validación de cobertura de sucursales rechaza destinos que antes aceptaba.

Todo esto afecta directamente el cálculo de liquidaciones (chofer, terciarizados, sellers, sucursales).

## Objetivo

Que cualquier regla configurada con nombre CABA-genérico (Buenos Aires, CABA, Capital Federal, Ciudad Autónoma) o con nombre de barrio siga matcheando contra los envíos CABA independientemente de que la ciudad guardada sea el barrio, siempre que el CP pertenezca a CABA. Sin tocar el resto de la lógica.

## Cambios

### 1. Nuevo helper compartido `src/lib/ciudadMatch.ts`

Exporta:

- `CABA_GENERICS`: set de nombres normalizados que representan "CABA a nivel ciudad" (buenos aires, caba, capital federal, ciudad autonoma de buenos aires, ciudad de buenos aires).
- `isCABACP(cp)`: reutiliza el rango existente de `cabaBarriosByCP` (C1xxx y 1000-1499) para saber si un CP es CABA.
- `isCABABarrio(nombre)`: chequea contra los valores del mapa `CABA_BARRIOS_BY_CP`.
- `ciudadMatch(zoneCity, shipmentCity, shipmentCP?)`: devuelve `boolean`.
  - Normaliza ambos (lowercase + strip acentos + trim).
  - Match directo (igualdad o substring en cualquier dirección) → true.
  - Si `shipmentCP` es CABA **y** (zoneCity es CABA genérico **o** zoneCity es barrio CABA) → true.
  - Si zoneCity es barrio CABA **y** shipmentCity es CABA genérico → true.
  - Si zoneCity es CABA genérico **y** shipmentCity es barrio CABA → true.
- `ciudadMatchExact(...)` y `ciudadMatchPartial(...)` para respetar los niveles de prioridad donde hoy se diferencian ambos.

### 2. Copia en `supabase/functions/_shared/ciudadMatch.ts`

Versión Deno del mismo helper (sin `import` a `src/`) para reutilizar en edge functions.

### 3. Puntos de integración (usar el helper, sin cambiar el flujo)

Frontend:

- `src/pages/DriverSettlements.tsx`
  - `matchZonaRegla`: reemplaza los pasos 2 y 3 (ciudad exacta / parcial) por `ciudadMatchExact` y `ciudadMatchPartial` pasando el CP del envío.
  - `findZoneTarifaPrecio` y `findZoneTarifaComision`: reemplazar los dos bucles de ciudad por `ciudadMatch` pasando `cp_entrega`.
- `src/pages/ecommerce/Settlements.tsx` (bloques `zona_destino` para sellers y default): mismo reemplazo, pasando el CP del envío.
- `src/pages/NewShipment.tsx` (`encontrarTarifaPorDestino`): pasar CP y usar `ciudadMatch`.
- `src/components/ecommerce/CreateShipmentFromOrderDialog.tsx`: idem donde matchea `zona_destino`.
- `src/lib/resolveTerciarizadoPrice.ts`: aceptar `cp_entrega` en `EnvioForPricing` (ya existe en la tabla) y usar `ciudadMatch` para comparaciones exact/partial de `zonas.ciudades`.
- `src/hooks/useCoverageValidation.ts`: usar `ciudadMatch` para el chequeo de ciudad, priorizando el match por CP existente.

Edge functions:

- `supabase/functions/public-rates/index.ts` → `encontrarTarifaPorDestino` usa el helper compartido y recibe el CP.
- `supabase/functions/mercadolibre-webhook/index.ts` → sección "Calculate price by zone matching" (línea ~331) usa el helper.

### 4. Sin migración de datos

No se necesita modificar filas: el helper resuelve la equivalencia en tiempo de query. Se mantiene el orden actual de prioridad (CP > ciudad exacta > ciudad parcial > provincia > global).

## Verificación

1. Envío con `ciudad_entrega = 'Palermo'`, `cp_entrega = 'C1425'`:
   - Regla chofer con `ciudad = 'Buenos Aires'` → matchea (nuevo).
   - Regla chofer con `ciudad = 'Palermo'` → matchea (ya funcionaba).
   - Regla chofer con `codigo_postal_desde = 1425` → matchea (ya funcionaba, sin cambios).
2. Tarifa por zona con `zona_destino = 'CABA'` y envío Palermo → devuelve precio_base.
3. Terciarizado con `ciudades = ['Capital Federal']` y envío Villa Crespo (CP 1414) → devuelve precio de la zona.
4. Envío interior (ej. Córdoba capital, CP 5000) no debe matchear ninguna regla CABA → sin regresión.
5. Correr una liquidación de prueba del chofer que motivó el reporte y confirmar que los envíos CABA vuelven a tomar la comisión de zona configurada.

## Notas técnicas

- El helper trata CABA como caso especial; no se agrega lógica genérica por provincia para evitar cambiar el comportamiento del interior.
- El fallback por provincia y el catch-all global existentes se dejan intactos.
- No hay cambios de schema ni de datos; solo lógica de comparación.

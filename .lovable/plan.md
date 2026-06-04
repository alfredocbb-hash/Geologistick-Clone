## Contexto

En el video se reproducen dos problemas al crear un envío Puerta a Puerta + Retiro para Almacenaje, origen PERON (San Justo, 1754) → destino CHURRINCHES 150, VILLA VENTANA, CP 8163:

1. La sección **Tarifa** muestra el aviso "Ingresá ciudad destino — Precio automático por zona" aun teniendo cargada la ciudad/CP del destino → el matcher por zona no encuentra Villa Ventana 8163.
2. Al hacer click en **Crear Envío**, la app cae al `ChunkErrorBoundary` global ("Algo salió mal — Se produjo un error inesperado"). No es un toast de la mutación: es una excepción en render que sube hasta el boundary.

Resultado deseado: bloquear el submit con un mensaje claro cuando no hay tarifa configurada para la zona, y eliminar la posibilidad de crash en render.

## Plan

### 1. Tests del flujo de creación de envío (Vitest + Testing Library)

Setup mínimo (instalar `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `vitest.config.ts`, `src/test/setup.ts` — si no están).

Suite `src/pages/__tests__/NewShipment.test.tsx` con mocks de `@/integrations/supabase/client`, `@/lib/auth` y `react-router-dom`. Casos:

- **TC1 — Tarifa no resuelta**: render con destino "Villa Ventana / 8163" sin tarifa matcheada. Esperar: warning visible, `precioCalculado === 0`, botón "Crear Envío" deshabilitado con tooltip/mensaje "No hay tarifa configurada para esta zona". NO debe dispararse la mutación.
- **TC2 — Tarifa OK**: render con destino que matchea zona. Botón habilitado, click dispara `findOrCreateClient` + `insert` en `envios` con `precio_total > 0`.
- **TC3 — findOrCreateClient cross-tenant**: simular DNI duplicado en otro tenant. Esperar que NO retorne el id ajeno y cree cliente nuevo en el tenant actual (ya cubierto por los filtros `.eq('tenant_id', …)`, pero queremos un regression test).
- **TC4 — Preflight teléfono**: simular `clientes` que ya tiene el mismo `telefono_normalizado`. Esperar reuse sin lanzar 23505.
- **TC5 — Render no crashea con datos nulos**: `tarifa = null`, `conceptosPreciosFiltrados = []`, `origenCoords = null`, `destinoCoords = null`, `montosEditables = {}`. El componente debe montar sin tirar.
- **TC6 — Submit con tarifa null**: si por alguna razón se intenta submit sin tarifa (TC5 + click forzado), el handler debe abortar limpio (early-return + toast) en vez de llamar a `insert`.

Estos tests se corren con la herramienta de tests interna (`bunx vitest run`).

### 2. Guard de submit cuando no hay tarifa (UI + lógica)

- Calcular `tarifaResuelta = boolean` en función de: zona matcheada O `tarifa_id` seleccionado manualmente O `precioCalculado > 0` con override manual.
- Deshabilitar el botón "Crear Envío" cuando `!tarifaResuelta && !esRetiroAlmacenaje` (almacenaje puede no requerirla).
- Mostrar mensaje inline arriba del botón: "No hay tarifa configurada para esta zona (Villa Ventana / 8163). Cargala en Tarifas → Zonas o seleccioná una tarifa manual".
- En `createShipmentMutation.mutationFn`, agregar un early-throw temprano con el mismo mensaje si por algún flow se llega al submit sin tarifa.

### 3. Hardening anti-crash en render

Aplicar fixes defensivos en los puntos identificados como vulnerables:

- `conceptosPreciosFiltrados?.forEach(...)` y `.find(...)` con optional chaining + fallback a `[]`.
- `Number(cp.porcentaje)` / `Number(cp.monto)` envueltos para evitar `NaN` propagado a `precio_total` (`Number.isFinite` check, si no → 0).
- `c.codigo?.toLowerCase()` y `c.nombre?.toLowerCase()` (ya está, validar resto del archivo).
- En el render del bloque Tarifa, evitar `tarifa.zona.precio.toFixed(2)` sin verificar nulos.
- Wrap del subtree de NewShipment con un `ErrorBoundary` local que:
  - persista la excepción en `system_error_logs` (vía `logError`),
  - muestre un fallback contextual ("Hubo un error al preparar el envío") con botón "Volver" en vez del boundary global anónimo.

### 4. Aviso "Ingresá ciudad destino" mejorado

Aunque la ciudad esté cargada, el aviso aparece porque el matcher de zona devuelve null. Cambiar el copy según el estado real:

- Ciudad/CP vacío → "Ingresá ciudad destino para calcular el precio".
- Ciudad/CP cargado pero zona no matcheada → "No hay tarifa por zona para {ciudad} ({cp}). Configurá la zona o ingresá precio manual".

### 5. QA manual (post-implementación)

1. Reproducir el caso del video (Villa Ventana / 8163): el botón debe quedar deshabilitado con el mensaje claro y NO ocurrir crash.
2. Cambiar destino a una ciudad con zona configurada: precio se autocompleta y submit funciona.
3. Cargar tarifa para Villa Ventana 8163 desde Tarifas: el aviso desaparece y submit funciona.
4. Verificar en `system_error_logs` que no haya nuevos eventos del path NewShipment.

## Detalles técnicos

- Archivos a tocar: `src/pages/NewShipment.tsx` (guard + hardening), nuevo `src/pages/__tests__/NewShipment.test.tsx`, nuevo `src/components/shipments/NewShipmentBoundary.tsx`, posible `vitest.config.ts` + `src/test/setup.ts` si no existen.
- Sin cambios de schema ni RLS. Sin migraciones.
- Memoria: tarifa por zona ya documentada en `mem://features/tarifa/motor-de-tarifas-matching-y-seguridad` — no requiere update.

## Fuera de alcance

- Crear automáticamente tarifas para CPs no configurados.
- Geocoding o validación de cobertura adicional.
- Cambios en `findOrCreateClient` (ya quedó robusto en el iteración anterior; solo lo cubrimos con regression tests).

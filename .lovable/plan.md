# Comisiones de chofer por zona/localidad

Agregar un esquema dedicado para que cada chofer pueda comisionar de forma diferenciada según ciudad / provincia / código postal, manteniendo compatibilidad con los tipos actuales (`tarifa`, `porcentaje`, `fija`, `mixta`).

## 1. Base de datos

Nueva tabla `chofer_comisiones_zona`:

- `chofer_id` (FK a `choferes`)
- `tenant_id`
- `ciudad`, `provincia` (texto, opcionales)
- `codigo_postal_desde`, `codigo_postal_hasta` (opcionales)
- `monto_fijo` (numeric, default 0)
- `porcentaje` (numeric, default 0)
- `prioridad` (int, para resolver empates)
- `activa` (bool)
- timestamps

Reglas:
- GRANT a `authenticated` + `service_role`.
- RLS: solo usuarios del mismo tenant pueden CRUD; super_admin acceso total.
- Índice por `(chofer_id, activa)`.

Extender enum/columna `choferes.comision_tipo` para aceptar el nuevo valor **`'zona'`**.

## 2. Lógica de cálculo (`DriverSettlements.tsx`)

Ampliar `calcularComision()` con un nuevo caso `'zona'`:

1. Buscar en `chofer_comisiones_zona` del chofer una regla activa que matchee, en este orden:
   - Match exacto por `ciudad` (normalizada, sin acentos) → reusar helper de `useCoverageValidation`.
   - Match por rango de CP (`codigo_postal_desde/hasta`).
   - Match por `provincia`.
   - Fallback: si el chofer tiene `comision_fija` o `comision_porcentaje` cargados, usar esos como red de seguridad.
2. Aplicar `precio × % + fijo` de la regla encontrada.
3. Si no hay match y no hay fallback → comisión 0 con marca **"sin config zona"** (similar al patrón ya usado en `ConceptBreakdownTable` con el aviso `sin config`).

Cargar las reglas del chofer en una sola query antes del cálculo (igual que se hace hoy con `tarifas` zonales) y armar un `Map<chofer_id, reglas[]>`.

## 3. UI de gestión

En el formulario/perfil del chofer (Drivers), nueva sección **"Comisiones por zona"** visible cuando `comision_tipo = 'zona'` o como tab independiente:

- Tabla con columnas: Ciudad / Provincia / CP desde-hasta / % / Fijo / Activa / Acciones.
- Botón "Agregar regla" → dialog con los campos.
- Validaciones: al menos uno entre ciudad, provincia o rango de CP.
- Ordenable por prioridad.

En el selector de `comision_tipo` agregar la opción **"Por zona/localidad"** con tooltip explicativo.

## 4. Liquidación: visualización

En `SettlementDetailDialog` y export PDF/Excel, cuando la comisión viene de una regla zonal:
- Mostrar en una columna extra la zona/ciudad aplicada (ej. "Belgrano · 12%").
- Si no matcheó → badge `sin config zona` (patrón ya existente).

## 5. Memory

Agregar memory:
- `features/settlements/comisiones-chofer-por-zona` — describiendo el orden de matching (ciudad → CP → provincia → fallback del chofer) y la convivencia con `comision_tipo='tarifa'`.

## Detalles técnicos

- Reusar `normalize()` (lowercase + sin acentos) — ya existe en `useCoverageValidation` y en `findZoneTarifaPrecio`.
- Reusar `extractNumericCP()` + `cpInRange()` para el matching de CP argentinos alfanuméricos.
- No tocar la lógica actual `'tarifa'` para no romper tenants existentes.
- Recálculo de pendientes sigue funcionando: por la memory `recalculo-comisiones-pendientes`, los envíos no liquidados se recalculan al abrir la liquidación, así que cambios de reglas se reflejan sin migrar histórico.
- Históricos ya liquidados mantienen su `comision_monto` congelado.

## Archivos afectados

- Migración SQL nueva.
- `src/pages/DriverSettlements.tsx` — extender `calcularComision`, cargar reglas.
- `src/pages/Drivers.tsx` + componente nuevo `DriverZoneCommissionsTab.tsx`.
- `src/components/settlements/SettlementDetailDialog.tsx` — mostrar zona aplicada.
- `src/lib/exportExcel.ts` / `generateSettlementPDF.ts` — agregar columna zona.
- Memory file nuevo.

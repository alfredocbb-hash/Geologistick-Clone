## Diagnóstico

Consulté las reglas de Ariel Kersul y los envíos del rango (18-24/05).

**Reglas cargadas (4):**
| Ciudad | Provincia | CP | Monto |
|---|---|---|---|
| Berazategui | Buenos Aires | 1880–1884 | $3300 |
| Berazategui 2 | Buenos Aires | `1893,1893,1885,1890,...` (lista, no rango) | $3300 |
| Quilmes | Buenos Aires | — | $3300 |
| Florencio Varela | Buenos Aires | — | $3300 |

**Envíos liquidados:** mayoría en Merlo, Caballito, Ituzaingó, Temperley, Canning, La Matanza, etc. Sólo 1 en Florencio Varela.

**Por qué todos dan $3300:**

`matchZonaRegla` corre 4 pasos. Los pasos 1–3 (ciudad exacta, CP, ciudad parcial) no encuentran nada para Merlo/Caballito/etc. Pero el paso 4 (provincia) busca cualquier regla con `provincia` cargada — y las 4 reglas tienen `provincia = "Buenos Aires"`. Como están ordenadas por `prioridad = 100` (empate), agarra la primera = Berazategui → **$3300 a todo lo que está en Bs. As.**

Además, el campo `codigo_postal_desde` de "Berazategui 2" guarda la lista `"1893,1893,1885,..."` como string. La función `extractCP` la convierte a un número gigante inválido, así que esa regla no matchea por CP a ningún envío.

No existe una regla "resto = $6000".

## Solución

### 1. Fix de lógica de matching (`src/pages/DriverSettlements.tsx`)
Cambiar `matchZonaRegla` para que cada regla se considere sólo en su nivel más específico:
- **Paso 1 (ciudad exacta)** — sólo reglas con `ciudad` no nulo.
- **Paso 2 (CP range)** — sólo reglas con `codigo_postal_desde` no nulo **y `ciudad` nulo**.
- **Paso 3 (ciudad parcial)** — sólo reglas con `ciudad` no nulo.
- **Paso 4 (provincia)** — sólo reglas con `provincia` no nulo **y `ciudad` nula **y `codigo_postal_desde` nulo** (catch-all real por provincia).

Resultado: la regla "Berazategui · Buenos Aires" deja de funcionar como fallback de toda la provincia.

### 2. Soporte multi-CP en `DriverZoneCommissionsManager.tsx` + `matchZonaRegla`
Permitir cargar lista de CPs separados por coma en `codigo_postal_desde` (lo que el usuario ya intentó). Si el valor contiene comas, parsear como `Set<number>` y matchear por inclusión exacta. Mantener compatibilidad con rangos (`desde`–`hasta`) si no hay coma.

UX en el form: agregar texto de ayuda "Podés cargar un rango (1880–1884) o lista separada por comas (1880,1885,1890)".

### 3. Acción sobre los datos de Ariel (vos en la UI, después del fix)
- Editar las 4 reglas existentes y **borrar el campo "Provincia"** (dejar sólo ciudad/CP).
- Corregir la regla "Berazategui 2" usando el nuevo soporte multi-CP.
- Crear una **regla catch-all** sin ciudad ni CP, con `provincia = "Buenos Aires"`, `monto_fijo = 6000`, `prioridad = 999`. Esta va a aplicar a todo envío en Bs. As. que no matchee ninguna regla específica.
- Opcional: crear otra catch-all sin ciudad/CP/provincia con prioridad 9999 para envíos fuera de Bs. As.

### 4. UI: mostrar regla aplicada en la tabla de liquidación
En la fila del envío, mostrar un badge chiquito con la ciudad/provincia matcheada (o "sin match → fallback chofer") para que sea evidente qué regla se aplicó. Ayuda a debuggear casos como este sin tener que abrir consola.

## Archivos a tocar

- `src/pages/DriverSettlements.tsx` — `matchZonaRegla` (especificidad + multi-CP), columna badge regla aplicada.
- `src/components/users/DriverZoneCommissionsManager.tsx` — placeholder y helper text para multi-CP.
- `mem://features/settlements/comisiones-chofer-por-zona` — actualizar describiendo nueva regla de especificidad y catch-all por provincia.

No hace falta migración: los cambios son sólo de lógica y UX.

## Confirmación

¿Avanzo con este plan? Tras implementarlo te indico exactamente qué reglas editar/crear en el perfil de Ariel.

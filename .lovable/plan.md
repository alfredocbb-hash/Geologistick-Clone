
## Objetivo
En el dialog "Crear Hoja de Ruta" (`src/pages/RouteSheets.tsx`), agrupar la lista de envíos disponibles por localidad/ciudad para facilitar la selección masiva cuando se arma una hoja de ruta hacia una sucursal.

## Contexto
Actualmente la tabla muestra todos los envíos planos (65 en el ejemplo) ordenados sin criterio geográfico, lo que obliga a buscar visualmente uno por uno. Como las hojas de ruta agrupan paquetes que viajan juntos a la misma sucursal destino, agruparlos por **ciudad de entrega** acelera la selección.

Ya existe precedente en el sistema: el Planificador de Rutas usa `normalizarCiudad` para agrupar por localidad (ver memoria `route-planner/normalizacion-ciudades-agrupamiento`). Reutilizamos el mismo criterio.

## Cambios

**Archivo único:** `src/pages/RouteSheets.tsx` — sección del dialog "Crear Hoja de Ruta" (la tabla de "Envíos Disponibles").

1. **Agrupar `enviosPendientes` por `ciudad_entrega`** (normalizada: trim + lowercase + sin tildes), ordenando los grupos alfabéticamente y mostrando primero las ciudades con más envíos.

2. **Reemplazar la tabla plana por secciones colapsables** (usando `Collapsible` ya disponible en `src/components/ui/collapsible.tsx`):
   - Header de cada grupo: nombre de localidad + contador `(N envíos)` + checkbox "Seleccionar todos los de esta localidad" + chevron expand/collapse.
   - Contenido: las filas actuales (tracking, destinatario, bultos, checkbox individual).
   - Por defecto: todos los grupos colapsados si hay más de 3 ciudades; expandidos si son pocos.

3. **Acción "Seleccionar todos de [ciudad]"** en cada header de grupo: agrega/quita los IDs del grupo del estado `selectedEnvios`.

4. **Mantener** los botones globales "Seleccionar todos" / "Deseleccionar" arriba de la lista, sin cambios.

5. **Buscador opcional** (mejora menor): un input de filtro por tracking/destinatario/ciudad arriba de los grupos para acelerar más la búsqueda en listas largas (65+ envíos).

## Diagrama

```text
┌─ Envíos Disponibles (65) ──── [Sel.todos] [Deselec.] ─┐
│ [🔍 buscar...]                                         │
├────────────────────────────────────────────────────────┤
│ ▼ ☐ La Plata (12 envíos)              [Sel. grupo]    │
│     ☐ ML-46512... | Juan Pérez       | 1              │
│     ☐ ML-46513... | María López      | 2              │
│ ▶ ☐ Berisso (8 envíos)                [Sel. grupo]    │
│ ▶ ☐ Ensenada (5 envíos)               [Sel. grupo]    │
│ ▶ ☐ Magdalena (3 envíos)              [Sel. grupo]    │
└────────────────────────────────────────────────────────┘
```

## Detalles técnicos
- Función `normalizarCiudad(ciudad: string)` local: `(c||'sin ciudad').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')`. Display: capitalizar el original (primer envío del grupo).
- `useMemo` para construir `gruposPorCiudad: { ciudad: string; envios: EnvioPendiente[] }[]`, recalculado cuando cambia `enviosPendientes` o el filtro de búsqueda.
- Estado local `expandedCities: Set<string>` para tracking de qué grupos están abiertos.
- Helper `toggleGrupoSeleccion(ciudadKey)`: si todos los del grupo ya están en `selectedEnvios`, los remueve; si no, los agrega todos.
- Helper `isGrupoSelected(ciudadKey)` y `isGrupoIndeterminate(ciudadKey)` para el estado tri-state del checkbox del header.

## Riesgo
Bajo. Cambio aislado al render de la lista dentro del dialog "Crear Hoja de Ruta". No toca lógica de creación, mutaciones, ni el resto de la página.

## Verificación
1. Abrir Hojas de Ruta → "Nueva Hoja de Ruta" → seleccionar sucursal destino.
2. Confirmar que los envíos aparecen agrupados por ciudad con contador.
3. Click en checkbox del header de grupo → seleccionar todos los de esa localidad.
4. Click en "Seleccionar todos" global → marca todos los grupos.
5. Crear la hoja de ruta y verificar que se generan correctamente los `hoja_ruta_envios`.

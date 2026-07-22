## Objetivo

En `src/pages/Incidents.tsx` mostrar el **remitente / seller** de cada envío y agregar **filtros** para ubicar incidencias más rápido, tanto en la pestaña de incidencias activas como en "Canceladas / Devoluciones".

## Cambios

### 1. Traer datos del remitente en las queries
- Incluir `nombre_remitente` en el `select` del envío embebido de la query de `incidentes`.
- Incluir `nombre_remitente` en la query de `incidents-canceladas`.

### 2. UI — Mostrar remitente
- En cada card/fila de incidencia activa: agregar línea "Remitente: {nombre_remitente}" bajo el destinatario.
- En la tabla de "Canceladas / Devoluciones": nueva columna **Remitente**.

### 3. Filtros nuevos (aplican a ambas pestañas)
Barra de filtros encima del listado con:
- **Búsqueda** (ya existe): extender el match para incluir `nombre_remitente`.
- **Remitente / Seller**: `Select` poblado con los remitentes distintos presentes en los resultados.
- **Chofer**: `Select` con los choferes distintos presentes en los resultados.
- **Tipo de incidencia**: `Select` con los tipos existentes (`tipo` de `incidentes`) — solo visible en la pestaña activa.
- Botón **Limpiar filtros**.

Los filtros se aplican en cliente sobre los datos ya cargados (mismo patrón que el buscador actual) y se combinan entre sí.

### 4. Sin cambios en lógica de negocio
- No se modifican queries de estados, reglas de cancelación, ni el flujo de "Devolver al remitente".
- Solo lectura + presentación + filtrado en cliente.

## Archivos afectados
- `src/pages/Incidents.tsx` (único archivo tocado).

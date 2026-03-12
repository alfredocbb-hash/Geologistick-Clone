

# Reorganizar Hojas de Ruta: Tabs por contexto + Recepción manual

## Problema
1. Los botones de "Recibir en Sucursal" y "Recibir Hoja de Ruta" están mezclados en la página de Scan, pero deberían estar en su propia sección dentro de Operaciones.
2. Las sucursales ven TODAS las hojas de ruta, pero solo deberían ver:
   - **Recepción**: Hojas de ruta con destino a su sucursal (pendientes de recibir)
   - **Despachos**: Hojas de ruta emitidas desde su sucursal hacia otros destinos
3. Falta la posibilidad de recibir una hoja de ruta de forma manual (sin escanear QR).

## Solución

### 1. Reestructurar `RouteSheets.tsx` con Tabs contextuales

Reorganizar la página de Hojas de Ruta en **3 tabs** para usuarios de sucursal (admins ven todo):

- **Despachos** (emitidas): Hojas donde `sucursal_origen_id = mi sucursal`. Incluye botón "Nueva Hoja de Ruta".
- **Recepción** (por recibir): Hojas donde `sucursal_destino_id = mi sucursal` y `estado IN ('pendiente', 'en_transito')`. Incluye botón "Recibir" por cada hoja y opción de recepción manual (input de número de hoja + búsqueda).
- **Historial**: Todas las hojas completadas/recibidas vinculadas a mi sucursal.

Para admins, se mantiene la vista completa sin filtros obligatorios.

**Filtrado**: En la query principal, se separan las hojas en `despachos` (origen = mi sucursal) y `recepciones` (destino = mi sucursal) usando filtro client-side ya que RLS ya restringe la visibilidad correctamente.

### 2. Agregar recepción manual de hojas de ruta

En el tab "Recepción":
- Listar hojas pendientes dirigidas a la sucursal del usuario con botón **"Recibir"** que abre el `ReceiveRouteSheetDialog` existente.
- Agregar un campo de búsqueda manual: input para ingresar número de hoja (ej: `HR-20260312-0001`) + botón buscar, que busca la hoja y abre el mismo diálogo de recepción.

### 3. Actualizar Sidebar

Renombrar "Hojas de Ruta" a "Despachos y Recepción" en el sidebar (`AppSidebar.tsx`), o mantener "Hojas de Ruta" pero con el nuevo layout interno con tabs.

### 4. Limpiar ScanQR.tsx

Remover el botón "Recibir Hoja de Ruta" de la página de Scan (`ScanQR.tsx` líneas 496-506), ya que esta funcionalidad estará en la nueva sección dedicada. Mantener el escaneo QR genérico que sigue funcionando para hojas de ruta cuando se escanea un QR.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/RouteSheets.tsx` | Agregar Tabs (Despachos / Recepción / Historial), filtrar por sucursal, agregar recepción manual con input + búsqueda + `ReceiveRouteSheetDialog` |
| `src/pages/ScanQR.tsx` | Remover botón "Recibir Hoja de Ruta" de acciones rápidas |
| `src/components/layout/AppSidebar.tsx` | Renombrar item a "Despachos / Recepción" (opcional) |

No se requieren cambios de RLS — la política actual ya filtra por `sucursal_origen_id` o `sucursal_destino_id` para roles de sucursal.


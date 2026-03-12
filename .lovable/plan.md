

# Botón "Reabrir Ruta" para rutas cerradas accidentalmente

## Problema
Un chofer puede cerrar una ruta por error (`close_ruta_planificada` cambia estado a `completada`). Actualmente no hay forma de revertirlo desde la UI.

## Solución

### 1. Nueva función SQL: `reopen_ruta_planificada`
- Solo admins/super_admins pueden ejecutarla (validación con `is_admin(auth.uid())`)
- Cambia `rutas_planificadas.estado` de `completada` → `en_curso`
- Re-asigna los envíos pendientes (no entregados/devueltos/cancelados) al chofer, estado → `en_reparto`
- Inserta registro en `envio_historial` para cada envío reactivado
- Retorna JSON con resultado y cantidad de envíos reactivados

### 2. Nuevo componente: `ReopenRouteDialog.tsx`
- Dialog de confirmación con resumen de la ruta (número, chofer, fecha, paradas)
- Muestra cuántos envíos serán reactivados
- Botón "Reabrir Ruta" que invoca el RPC

### 3. Modificar `RoutePlanner.tsx` - pestaña "Historial"
- Agregar botón "Reabrir" en cada ruta completada del historial (solo visible para admins)
- Al hacer click, abre `ReopenRouteDialog`
- Al confirmar, la ruta vuelve a aparecer en "Rutas Activas"

**3 cambios: 1 migración SQL + 1 componente nuevo + 1 archivo modificado.**


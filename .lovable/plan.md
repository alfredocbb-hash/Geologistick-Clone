

# Permitir a admin/superadmin cerrar rutas planificadas y hojas de ruta

## Problema

Las funciones RPC `close_ruta_planificada` y `close_hoja_ruta` solo permiten al chofer asignado cerrar la ruta (`chofer_id = auth.uid()`). Un administrador no puede cerrar rutas desde el Planificador.

## Cambios

### 1. Migración SQL: actualizar ambas funciones RPC

Modificar `close_ruta_planificada` y `close_hoja_ruta` para que, además del chofer asignado, permitan el cierre a usuarios con rol `admin` o `super_admin` (usando `public.is_admin(auth.uid())`).

Lógica actualizada del check de permisos:
```sql
IF v_ruta.chofer_id != auth.uid() AND NOT public.is_admin(auth.uid()) THEN
  RETURN jsonb_build_object('success', false, 'error', 'No tienes permiso...');
END IF;
```

Aplicar lo mismo en ambas funciones.

### 2. UI: agregar botón "Cerrar Ruta" en pestaña Rutas Activas (`src/pages/RoutePlanner.tsx`)

En la tarjeta de cada ruta activa (línea ~1966), agregar un botón "Cerrar Ruta" (con icono `CheckCircle`) que:
- Muestre un `AlertDialog` de confirmación
- Llame a `supabase.rpc('close_ruta_planificada', { p_ruta_id })`
- Invalide las queries `rutas-activas` y `rutas-historial` al completar
- Muestre toast de éxito/error

Solo mostrar el botón para rutas en estado `en_curso`.


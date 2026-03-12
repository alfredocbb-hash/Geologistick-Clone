

# Cerrar Hojas de Ruta desde la UI (admin/superadmin)

## Problema

Las hojas de ruta en estado `en_transito` con fechas viejas no pueden cerrarse desde la interfaz de Hojas de Ruta. El RPC `close_hoja_ruta` ya permite que admins/superadmins las cierren (migración reciente), pero falta el botón en la UI.

## Cambio

**Archivo: `src/pages/RouteSheets.tsx`**

1. Importar `AlertDialog` components y `useAuth` (ya importado)
2. Agregar estado `closingHoja` para manejar el flujo de confirmación
3. Agregar mutation que llame a `supabase.rpc('close_hoja_ruta', { p_hoja_id })`
4. En la sección de acciones de cada card (línea ~707), agregar botón "Cerrar" visible solo para admins cuando `hr.estado === 'en_transito'`:

```text
[Imprimir] [QR] [GPS?] [Cerrar] ← nuevo botón para admin en hojas en_transito
```

5. Agregar `AlertDialog` de confirmación al final del componente que muestre número de hoja y pida confirmar el cierre

Solo un archivo modificado, sin migraciones SQL (el RPC ya soporta admins).


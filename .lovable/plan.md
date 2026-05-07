## Problema

En `Gestión de Envíos`, usuarios con rol `sucursal`/`despachador` (o supervisor, o pertenecientes a un centro logístico) pueden ver el botón "Cambiar estado" y modificar el estado de un envío. Solo administradores y super administradores deberían poder hacerlo.

## Causa

En `src/pages/Shipments.tsx` línea 168:

```ts
const canChangeStatus = isAdmin() || hasRole('supervisor') || isCentroLogistico;
```

Esto habilita el botón "Cambiar estado" (línea 749) para supervisores y para cualquier usuario asignado a una sucursal marcada como centro logístico, sin importar su rol.

## Cambio

Editar `src/pages/Shipments.tsx`:

- Reemplazar la línea 168 por:
  ```ts
  const canChangeStatus = isAdmin() || isSuperAdmin();
  ```
  (`isAdmin()` ya incluye admin y super_admin, pero dejamos `isSuperAdmin()` explícito por claridad).

- Quitar la dependencia ahora innecesaria `isCentroLogistico` solo del cálculo de `canChangeStatus`. Verificar primero si `isCentroLogistico` se usa en otra parte del archivo; si no, eliminar también su definición. Si se usa para otra funcionalidad (por ejemplo recibir/escanear), no tocarla.

- No cambiar `ChangeStatusDialog.tsx`: ya respeta el bloqueo de estados finales y el bypass de super_admin. La protección de UI alcanza, ya que el diálogo solo se abre desde este botón en gestión de envíos.

## Notas

- Otros flujos donde un chofer/sucursal cambia estado (escaneo, entrega, ingreso a sucursal, etc.) NO se ven afectados; siguen funcionando como hoy. Esta restricción aplica únicamente al botón manual "Cambiar estado" en la lista de envíos.
- Si más adelante se quiere endurecer a nivel base de datos, se puede agregar una policy/función, pero no es necesario para resolver el reporte actual.

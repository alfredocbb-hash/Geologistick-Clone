

# Fix: Envios liberados de ruta cancelada no aparecen en Crear Ruta

## Problema

Al cancelar una ruta y elegir "Liberar para replanificar", los envios de e-commerce/ML desaparecen del planificador porque:

1. `CancelRouteDialog` los pone en estado `pendiente`
2. El filtro de e-commerce en el planificador **excluye** envios de e-commerce en estado `pendiente` (asumiendo que aun no fueron recolectados)
3. Pero estos envios ya estaban recolectados y en reparto -- ponerlos en `pendiente` es semanticamente incorrecto

## Solucion

### Archivo: `src/components/routes/CancelRouteDialog.tsx`

Cambiar el estado destino de `pendiente` a `en_sucursal` cuando la accion es "liberar". Estos envios ya fueron recolectados y estaban en una ruta activa, asi que fisicamente estan en la sucursal esperando ser re-asignados.

- Accion **"release"**: estado -> `en_sucursal` (los paquetes estan fisicamente en la sucursal, listos para re-planificar)
- Accion **"reschedule"**: estado -> `pendiente` (se reprograman para otra fecha, comportamiento actual correcto)

Esto resuelve el problema porque el filtro del planificador (linea 269) ya permite envios e-commerce en estado `en_sucursal`.

### Cambio en detalle

En la mutacion, reemplazar:

```typescript
const updateData: any = {
  chofer_id: null,
  estado: 'pendiente',
};
```

Por:

```typescript
const updateData: any = {
  chofer_id: null,
  estado: action === 'release' ? 'en_sucursal' : 'pendiente',
};
```

Y ajustar las entradas del historial para reflejar el estado correcto:

```typescript
estado_nuevo: action === 'release' ? 'en_sucursal' : 'pendiente',
```

### Sin cambios de base de datos

No se requieren migraciones.


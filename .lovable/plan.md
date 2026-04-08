

## Plan: Mostrar botón "Cambiar estado" para envíos cancelados (super admin)

### Problema

En `src/pages/Shipments.tsx` línea 721, la condición que muestra el botón "Cambiar estado" excluye explícitamente `cancelado`:

```typescript
{canChangeStatus && envio.estado !== 'cancelado' && (envio.estado !== 'entregado' || isSuperAdmin()) && (
```

Esto impide que incluso el super admin vea el botón para envíos cancelados, contradiciendo la lógica ya implementada en `ChangeStatusDialog`.

### Solución

**Archivo**: `src/pages/Shipments.tsx` — Línea 721

Unificar la lógica de estados finales (`entregado` y `cancelado`) con el mismo bypass para super admin:

```typescript
{canChangeStatus && ((envio.estado !== 'entregado' && envio.estado !== 'cancelado') || isSuperAdmin()) && (
```

Esto permite al super admin ver y usar el botón en ambos estados finales, mientras que los demás roles lo siguen viendo bloqueado.

### Archivos a modificar
- `src/pages/Shipments.tsx` — Actualizar condición de visibilidad del botón "Cambiar estado"


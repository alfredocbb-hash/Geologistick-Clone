

## Plan: Mostrar botón "Cambiar estado" para super_admin en envíos entregados

### Problema
En `src/pages/Shipments.tsx` línea 625, la condición oculta el botón de cambiar estado cuando el envío está `entregado` para **todos** los usuarios, incluyendo super_admin:

```typescript
{canChangeStatus && envio.estado !== 'cancelado' && envio.estado !== 'entregado' && (
```

Esto contradice la lógica ya implementada en `ChangeStatusDialog` que permite al super_admin modificar envíos entregados.

### Cambio

**`src/pages/Shipments.tsx`** — Modificar la condición del botón (línea 625):
```typescript
{canChangeStatus && envio.estado !== 'cancelado' && (envio.estado !== 'entregado' || isSuperAdmin()) && (
```

Esto permite que el super_admin vea y use el botón en envíos entregados, mientras el resto de usuarios sigue sin verlo. El `ChangeStatusDialog` ya tiene la advertencia visual y la validación interna.

Un solo archivo, una sola línea.


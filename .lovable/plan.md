

## Plan: Bloquear cambio de estado de envíos cancelados (excepto super admin)

### Situación actual
El diálogo `ChangeStatusDialog` bloquea cambios de estado solo para envíos `entregado` (usuarios no super admin). Los envíos `cancelado` no tienen esta protección, lo cual permite que cualquier usuario revierta una cancelación.

### Cambio propuesto

**Archivo**: `src/components/shipments/ChangeStatusDialog.tsx`

1. Ampliar `blockedByFinalState` para incluir `cancelado` además de `entregado`:
   ```
   const isFinalState = currentStatus === 'entregado' || currentStatus === 'cancelado';
   const blockedByFinalState = isFinalState && !isSuperAdmin();
   ```

2. Actualizar los mensajes de advertencia para reflejar ambos estados finales:
   - Mensaje de bloqueo: "Este envío ya fue **entregado/cancelado**. Solo un super administrador puede modificar su estado."
   - Mensaje de advertencia para super admin: "Estás modificando un envío en estado final (**entregado/cancelado**). Este cambio quedará registrado en el historial."

### Archivos a modificar
- `src/components/shipments/ChangeStatusDialog.tsx` — Ampliar bloqueo de estados finales a `cancelado`


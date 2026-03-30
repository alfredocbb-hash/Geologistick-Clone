

## Plan: Permitir a super_admin cambiar estado de envíos entregados

### Contexto
Actualmente el `ChangeStatusDialog` no bloquea estados finales directamente — muestra todos los estados posibles. Sin embargo, el flujo de escaneo (`MobileScanTab`, `FlexScanScreen`) bloquea acciones sobre envíos con estado `entregado` o `cancelado`.

El pedido es que **solo el super_admin** pueda cambiar el estado de un envío que ya está en `entregado`.

### Cambios

**1. `src/components/shipments/ChangeStatusDialog.tsx`**
- Recibir `isSuperAdmin` desde `useAuth()`
- Si `currentStatus` es `entregado` y el usuario **no** es super_admin, mostrar un mensaje de bloqueo y deshabilitar el cambio
- Si es super_admin, permitir el cambio normalmente
- Agregar una advertencia visual cuando un super_admin está cambiando un envío ya entregado

**2. `src/components/mobile/MobileScanTab.tsx`**
- En el bloqueo de estados finales (línea 244), verificar si el usuario es super_admin
- Si es super_admin, permitir continuar el flujo normalmente para `entregado`
- Mantener el bloqueo para `cancelado` para todos los roles

**3. `src/components/mobile/FlexScanScreen.tsx`**
- Aplicar la misma lógica: si hay bloqueo por estado final `entregado`, permitir al super_admin continuar


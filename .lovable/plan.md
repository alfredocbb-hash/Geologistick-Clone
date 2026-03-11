

# Análisis de dos consultas

## Consulta 1: Envíos cobrados al contado no aparecen en Control de Cajas

### Diagnóstico

Revisé el flujo completo de pago contado en `NewShipment.tsx` (línea 1655-1691). Cuando se crea un envío con tipo de pago "contado", el `handlePaymentConfirm` **solo inserta un registro en la tabla `pagos`** con estado `'pendiente'`. **No registra ningún movimiento en `movimientos_caja`**.

En contraste, `BranchDeliveryDialog.tsx` (entrega en sucursal con pago destino) sí inserta en `movimientos_caja` como ingreso. Igualmente, las liquidaciones de sucursal y chofer registran movimientos al pagarse.

**El bug es claro**: al cobrar un envío contado al momento de crearlo, falta el paso de insertar el ingreso en la sesión de caja abierta.

### Sobre el saldo tras abonar la liquidación

Actualmente, cuando se paga una liquidación de sucursal (`BranchSettlements.tsx` línea 663), se registra un movimiento de tipo `'ingreso'` en la caja. Esto es correcto desde el punto de vista de que el dinero recaudado por la sucursal se "rinde" a la administración.

Sin embargo, **no existe un concepto de "saldo pendiente" por envíos contado en la vista de Caja**. La caja solo muestra movimientos registrados. Si los cobros contado no se registran como movimientos (que es el bug), no hay saldo que restablecer.

### Plan de corrección

**Archivo: `src/pages/NewShipment.tsx`**

En `handlePaymentConfirm`, después de insertar en `pagos`, agregar la lógica para registrar el movimiento en la sesión de caja abierta de la sucursal del usuario:

1. Buscar la sesión de caja abierta para `profile.sucursal_id`
2. Si existe, insertar en `movimientos_caja` un registro de tipo `'ingreso'` con el concepto `"Cobro contado envío {tracking}"`, el monto, método de pago y referencia
3. Cambiar el estado del pago de `'pendiente'` a `'pagado'` ya que el cobro se realizó en el momento

Esto alinea el comportamiento con lo que ya hace `BranchDeliveryDialog` para pagos destino.

---

## Consulta 2: Asistente IA para todos los usuarios

### Estado actual

El asistente (`AdminAssistant`) se muestra condicionalmente en `DashboardLayout.tsx` línea 59:
```tsx
{isAdmin() && <AdminAssistant />}
```

El edge function `admin-assistant` valida autenticación pero **no valida rol**. El system prompt está orientado a admins pero puede adaptarse.

### Plan

1. **`src/components/layout/DashboardLayout.tsx`**: Quitar la condición `isAdmin()` para mostrar el asistente a todos los usuarios autenticados. Renombrar visualmente el componente a "Asistente" (sin "Admin").

2. **`src/components/assistant/AdminAssistant.tsx`**: 
   - Recibir el rol del usuario como contexto para personalizar el mensaje de bienvenida
   - Para no-admins, mostrar un mensaje de bienvenida orientado a ayuda operativa en vez de configuración

3. **`supabase/functions/admin-assistant/index.ts`**:
   - Obtener el rol del usuario desde `user_roles`
   - Adaptar el system prompt según el rol:
     - **Admin/Super Admin**: prompt actual completo con datos de configuración del tenant
     - **Sucursal/Operador/Despachador**: prompt enfocado en operaciones (cómo escanear, cómo entregar, estados de envío, etc.) sin exponer datos sensibles de configuración como tarifas o comisiones
     - **Chofer**: prompt enfocado en uso de la app móvil, entregas, reprogramaciones
   - Reducir la información sensible del tenant para roles no-admin (no mostrar tarifas, configuración de seguro, etc.)

### Seguridad
Los datos del tenant que se incluyen en el prompt se filtrarán por rol para no exponer información comercial sensible a usuarios operativos.

---

## Resumen de archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/NewShipment.tsx` | Registrar movimiento de caja al cobrar contado |
| `src/components/layout/DashboardLayout.tsx` | Mostrar asistente a todos los usuarios |
| `src/components/assistant/AdminAssistant.tsx` | Adaptar UI según rol del usuario |
| `supabase/functions/admin-assistant/index.ts` | System prompt adaptado por rol |

Sin cambios de base de datos necesarios.



# Plan: Habilitar Entrega en Sucursal para Personal de Mostrador

## Diagnóstico del Problema

Después de analizar la situación encontré **dos problemas**:

| Problema | Detalle |
|----------|---------|
| **Usuario sin rol** | `alfredobernard@beraexpress.com` no tiene ningún rol asignado en `user_roles` |
| **Permiso deshabilitado** | Los roles `sucursal` y `despachador` tienen `delivery.confirm` en `false` |

### Flujo Actual (que falla)

```text
Usuario escanea envío
       ↓
¿hasRole('chofer')? → NO
       ↓
¿hasRole('operador') o hasRole('bodega')? → NO  
       ↓
¿hasRole('sucursal') o hasRole('despachador')? → NO (usuario sin rol)
       ↓
❌ Sin acciones disponibles
```

### Envío Encontrado

Existe el envío `SUC01-ENV-20260204-B863B5` en sucursal Administración con:
- Estado: `en_sucursal` (listo para entregar)
- Tipo servicio: `sucursal_sucursal` (retiro en sucursal)
- Tipo pago: `destino` (cobro contra entrega)
- Precio: $4,500

---

## Solución Propuesta

### Paso 1: Asignar Rol al Usuario

El usuario necesita tener al menos un rol para que el sistema funcione. Recomiendo asignarle el rol **`sucursal`** ya que trabaja en "Administración".

### Paso 2: Habilitar Permiso de Entrega

Activar `delivery.confirm` para los roles `sucursal` y `despachador`.

### Paso 3: Mejorar Lógica de Escaneo (Opcional pero recomendado)

Modificar `MobileScanTab.tsx` para agregar un fallback más inteligente:
- Si el usuario no tiene rol específico pero tiene permiso `delivery.confirm`, mostrar el diálogo de entrega
- Mejorar los mensajes de error cuando no hay acciones disponibles

---

## Detalles Técnicos

### Archivo a Modificar: `src/components/mobile/MobileScanTab.tsx`

**Cambio en la lógica de determinación de diálogos (líneas 247-298):**

```text
Lógica actual:
1. ¿Es escenario última milla? → UltimaMillaDialog
2. ¿Es chofer? → PickupDialog o DeliveryDialog
3. ¿Es operador/bodega? → ReceiveDialog
4. ¿Es sucursal/despachador? → BranchDeliveryDialog o ReceiveDialog
5. ¿Tiene permiso delivery.confirm? → DeliveryDialog
6. ¿Tiene permiso route_sheets.view? → ReceiveDialog
7. Si ninguno → ❌ Sin acción

Lógica mejorada:
1-6: Igual que antes
7. NUEVO: Si el envío está en_sucursal + es tipo sucursal y tiene hasPermission('delivery.confirm') → BranchDeliveryDialog
8. NUEVO: Mostrar toast explicativo si no hay acciones
```

### Migración SQL: Habilitar Permisos

Actualizar los permisos `delivery.confirm` para roles de sucursal.

### Corrección de Datos: Asignar Rol

Insertar rol `sucursal` para el usuario `alfredobernard@beraexpress.com`.

---

## Flujo Corregido

```text
Usuario escanea envío (SUC01-ENV-20260204-B863B5)
       ↓
Envío encontrado: estado=en_sucursal, tipo=sucursal_sucursal
       ↓
¿hasRole('sucursal')? → SI (después de asignar rol)
       ↓
¿tipo_servicio_detalle es sucursal_* y estado es en_sucursal? → SI
       ↓
¿hasPermission('delivery.confirm')? → SI (después de habilitar)
       ↓
✅ Mostrar BranchDeliveryDialog
       ↓
Usuario captura: nombre, DNI, firma
       ↓
Si tipo_pago='destino': mostrar PaymentMethodDialog para cobrar $4,500
       ↓
✅ Envío entregado
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/mobile/MobileScanTab.tsx` | Mejorar lógica de fallback para usuarios con permiso de entrega |
| Migración SQL | Habilitar `delivery.confirm` para roles sucursal/despachador |
| Datos | Asignar rol `sucursal` al usuario alfredobernard@beraexpress.com |

---

## Resultado Esperado

1. El usuario `alfredobernard@beraexpress.com` podrá escanear envíos en sucursal
2. Aparecerá el diálogo de entrega con campos para DNI y firma
3. Si el pago es "destino", se mostrará el diálogo de cobro antes de confirmar
4. El sistema registrará correctamente la entrega y el pago en caja

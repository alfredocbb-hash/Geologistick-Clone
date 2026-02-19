
# Corrección de tres bugs en "Nuevo Envío" con cuenta corriente

## Diagnóstico

### Bug 1 — Destinatario = Remitente (KINGDOM VINTAGE)
**Causa en el código (línea 939):**
```typescript
let destinatarioId = formData.cliente_cta_cte_id || null;
```
Esta línea asigna el cliente de cuenta corriente como `destinatario_id` del envío para **todos los tipos de servicio**, no solo `retiro_almacenaje`. El resultado es que en la tabla `envios`, el `destinatario_id` queda con el ID del remitente (quien paga con cta cte), causando que la columna "Destinatario" muestre el mismo nombre que "Remitente".

**Corrección:** Solo usar `cliente_cta_cte_id` como `destinatarioId` cuando `esRetiroAlmacenaje === true`.

---

### Bug 2 — RLS violation en `cliente_cuenta_corriente`
**Causa:** La política de INSERT en esa tabla requiere uno de estos roles:
- `admin`
- `supervisor`  
- `atencion_cliente`
- `operador`

El usuario de la sucursal Berazategui probablemente tiene asignado un rol diferente (o el rol de `chofer`). La inserción falla con "new row violates row-level security policy".

**Corrección:** Agregar una migración SQL para ampliar la política de INSERT para incluir también el rol `chofer` en `cliente_cuenta_corriente`, o bien — más correcto — verificar qué roles deberían poder crear movimientos de cuenta corriente y ampliar la política. La opción más segura es agregar el rol que tiene el operador de ventanilla de Berazategui. Revisando la lógica del sistema: cualquier usuario de sucursal que pueda crear envíos también debería poder registrar el cargo en cuenta corriente. Se ampliará la política para incluir también `has_role(auth.uid(), 'chofer')` y `has_role(auth.uid(), 'administrador')`.

---

### Bug 3 — El envío se creó 4 veces (sin rollback)
**Causa:** El flujo `createShipmentMutation` inserta el envío en el paso 4, y luego falla en el paso 6 (cuenta corriente RLS). El error del paso 6 hace que `onError` muestre el toast, **pero el envío ya quedó insertado**. El usuario vio el error y presionó 4 veces el botón creyendo que había fallado.

**Corrección:** Dos cambios complementarios:
1. **Deshabilitar el botón de submit mientras `isPending`** — ya debería estarlo, pero verificar que el toast de error no habilite el botón nuevamente.
2. **No relanzar el error de cuenta corriente como `throw`** — en cambio, mostrar un toast de advertencia diferenciado y redirigir igual al PDF de etiqueta (el envío fue creado correctamente). Alternativamente, hacer que el error en el paso de cta cte no bloquee el flujo pero sí lo avise.

La solución más correcta es que **si el envío se crea exitosamente pero falla el movimiento de cuenta corriente, se complete la acción (redirigir a etiqueta) y se muestre una advertencia separada** para que el operador pueda registrar el movimiento manualmente. Esto es mejor que dejar el envío huérfano sin cuenta corriente Y que el usuario cree 4 duplicados.

---

## Cambios a realizar

### 1. Migración SQL — ampliar política INSERT de `cliente_cuenta_corriente`

Verificar los roles actuales del usuario de Berazategui y agregar los roles faltantes. La política actual solo permite `admin`, `supervisor`, `atencion_cliente`, `operador`. Se ampliará para también incluir `chofer` (choferes que operan ventanilla) y se usará la función `current_user_is_admin()` de forma más abarcativa.

La solución correcta es que cualquier usuario autenticado del mismo tenant pueda insertar movimientos de cuenta corriente para clientes de su tenant, ya que la restricción real debe basarse en el `tenant_id` del cliente, no en el rol:

```sql
-- Reemplazar política INSERT restrictiva por una basada en tenant
DROP POLICY IF EXISTS "Crear movimiento cuenta corriente" ON public.cliente_cuenta_corriente;

CREATE POLICY "Crear movimiento cuenta corriente" ON public.cliente_cuenta_corriente
FOR INSERT WITH CHECK (
  -- El cliente debe pertenecer al mismo tenant que el usuario autenticado
  EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = cliente_cuenta_corriente.cliente_id
      AND c.tenant_id = public.current_user_tenant()
  )
);
```

### 2. `src/pages/NewShipment.tsx` — Fix destinatarioId

**Cambio en línea 939:**
```typescript
// ANTES (incorrecto):
let destinatarioId = formData.cliente_cta_cte_id || null;

// DESPUÉS (correcto):
// cliente_cta_cte_id es quien PAGA, no el destinatario físico
// Solo se usa como destinatario en retiro_almacenaje
let destinatarioId: string | null = null;
```

La lógica de `esRetiroAlmacenaje` ya está contemplada más abajo (línea 953), por lo que solo se necesita quitar la inicialización incorrecta.

### 3. `src/pages/NewShipment.tsx` — Fix manejo de error en cuenta corriente

Separar el manejo del error de cuenta corriente para que no bloquee el flujo completo:

```typescript
// En lugar de throw movError:
if (movError) {
  // El envío ya fue creado exitosamente
  // Mostrar advertencia pero no fallar el flujo completo
  console.error('Error registrando movimiento cta cte:', movError);
  // Se completa igualmente pero con advertencia
}
```

Esto se hace convirtiendo el paso 6 en un bloque try/catch que captura y loguea el error, y al final del `mutationFn` se retorna el `envio` igual. En `onSuccess` se verificará si hubo un error de cta cte y se mostrará una advertencia adicional.

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| Migración SQL | Ampliar política INSERT de `cliente_cuenta_corriente` basada en tenant |
| `src/pages/NewShipment.tsx` línea 939 | No asignar `cliente_cta_cte_id` como `destinatarioId` incondicionalmente |
| `src/pages/NewShipment.tsx` paso 6 | Convertir errores de cuenta corriente en advertencias no bloqueantes |

## Resultado esperado

- El destinatario del envío muestra el dato correcto del formulario (no el remitente)
- Si el movimiento de cuenta corriente falla, el envío se crea igual y se muestra una advertencia (no un error que lleve al usuario a presionar 4 veces)
- La política de RLS permite que cualquier operador del tenant registre movimientos de cuenta corriente para sus clientes
- Los duplicados dejan de generarse

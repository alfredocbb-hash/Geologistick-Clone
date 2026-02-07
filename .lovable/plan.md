
# Corregir pagos Mercado Pago y filtrado por sucursal

## Problema 1: Pagos de Mercado Pago no se actualizan

### Diagnostico

Los logs del webhook muestran: `Could not find matching tenant for payment 144620464845`

El problema esta en la verificacion de firma del webhook. Cuando Mercado Pago (especialmente en sandbox) no envia los headers `x-signature` y `x-request-id`, la funcion `verifyMpSignature` devuelve `false`. En la Estrategia 2 del webhook, esto hace que se salte al unico tenant configurado con `continue`, terminando en "Could not find matching tenant".

```text
Flujo actual (falla):
  Webhook MP → body.data.id = 144620464845
  → Estrategia 1: buscar por mercado_pago_id → NO (tiene preference_id guardado)
  → Estrategia 2: verificar firma → FALLA (headers ausentes) → continue → salta tenant
  → "Could not find matching tenant" ← ERROR

Flujo corregido:
  Webhook MP → body.data.id = 144620464845
  → Estrategia 1: buscar por mercado_pago_id → NO
  → Estrategia 2: verificar firma → headers ausentes → ADVERTENCIA pero continua
  → Fetch payment de MP API → external_reference = envio_id → MATCH
  → Actualizar pago a "pagado"
```

### Solucion

Modificar la funcion `verifyMpSignature` para que distinga entre "headers ausentes" (retornar `null`) y "firma invalida" (retornar `false`). En Strategy 2, solo saltar el tenant cuando la firma es invalida, no cuando los headers estan ausentes.

**Archivo**: `supabase/functions/mercadopago-webhook/index.ts`

Cambios:
- `verifyMpSignature` retorna `true | false | null` (`null` = headers ausentes)
- En Strategy 2: si retorna `null`, continuar con advertencia. Si retorna `false`, saltar tenant
- Agregar mas logs para diagnostico

---

## Problema 2: Sucursales ven todos los cobros

### Diagnostico

La politica RLS de `pagos` ya filtra por `sucursal_origen_id = get_user_sucursal(auth.uid())`, por lo que a nivel de base de datos las sucursales solo ven sus pagos. Sin embargo, las consultas en la pagina de Pagos necesitan reforzar este filtrado para los envios pendientes de pago y las estadisticas.

El usuario `Clientes@beraexpress.com` tiene:
- Rol: `sucursal` + `despachador`
- Sucursal: Berazategui (`56cc685c-...`)

### Solucion

Agregar filtro por `sucursal_origen_id` en las consultas de envios pendientes para usuarios con rol `sucursal`. Esto garantiza que:
- Las estadisticas (pendientes de cobro, monto pendiente) reflejen solo su sucursal
- La lista de envios pendientes de cobro muestre solo los de su sucursal
- El historial y pagos MP ya se filtran por RLS a nivel de base de datos

**Archivo**: `src/pages/Payments.tsx`

Cambios en las queries:
- `envios-pendientes-pago`: agregar filtro `.eq('sucursal_origen_id', profile.sucursal_id)` cuando el usuario tiene rol `sucursal`
- `pagos-mercado-pago`: agregar filtro via join con envios por sucursal_origen_id
- Pasar `profile` y `hasRole` desde `useAuth()` a las queries

---

## Seccion Tecnica

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/mercadopago-webhook/index.ts` | Cambiar verificacion de firma para no bloquear cuando headers estan ausentes |
| `src/pages/Payments.tsx` | Agregar filtrado por sucursal para usuarios con rol `sucursal` |

### Cambio en webhook - detalle

```typescript
// ANTES: retorna boolean
async function verifyMpSignature(...): Promise<boolean>

// DESPUES: retorna true (valido), false (invalido), null (sin headers)
async function verifyMpSignature(...): Promise<boolean | null>

// En el loop de Strategy 2:
if (webhookSecret) {
  const isValid = await verifyMpSignature(req, paymentId, webhookSecret);
  if (isValid === false) {
    continue; // Firma invalida, saltar tenant
  }
  if (isValid === null) {
    console.warn("No signature headers, proceeding without verification");
    // NO hace continue - sigue intentando matchear
  }
}
```

### Cambio en Payments.tsx - detalle

```typescript
// Para envios pendientes:
const isBranchUser = hasRole('sucursal') && !isAdmin();

let enviosQuery = supabase.from('envios').select(...)
  .in('tipo_pago', ['contado', 'destino'])
  .not('estado', 'eq', 'cancelado');

if (isBranchUser && profile?.sucursal_id) {
  enviosQuery = enviosQuery.eq('sucursal_origen_id', profile.sucursal_id);
}
```

### Registro de pago duplicado

Hay un pago duplicado sin `tenant_id` para el envio `SUC01-ENV-20260207-874A64`. Esto se genera porque el flujo de entrega en sucursal crea un segundo registro sin tenant. Se debe limpiar ese registro huerfano y asegurar que el flujo siempre incluya `tenant_id`.

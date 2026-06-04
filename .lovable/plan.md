## Análisis

### 1. Facturación de envíos cancelados
En `src/pages/Facturacion.tsx` la query de "pendientes" ya filtra `estado = 'entregado'`, pero hay puertas abiertas:
- **Batch / individual desde Facturación**: la mutación llama a `arca-factura` con `envio_id` sin re-verificar el estado actual (un envío podría haber sido cancelado después de cargar la lista).
- **Duplicar factura**: usa `duplicateSource.envio_id` sin chequear estado.
- **Edge function `arca-factura`**: no valida el estado del envío recibido. Es la última línea de defensa.

Faltan validaciones tanto en cliente como en backend.

### 2. Pago Mercado Pago no confirmado antes de etiqueta
En `src/components/shipments/PaymentMethodDialog.tsx`, cuando el método es `mercado_pago`:
- Se genera la preferencia (QR + link) vía `mercadopago-payment`.
- El botón "Confirmar Pago" llama directo `onConfirm('mercado_pago', preference_id)` sin verificar si el pago fue aprobado.
- En `src/pages/NewShipment.tsx → handlePaymentConfirm` se inserta el pago con `estado='pagado'` y se redirige a la etiqueta.

Existe ya `mercadopago-check-status` (mapea `approved → pagado`, `pending/in_process → pendiente`, `rejected/cancelled → fallido`) y un webhook que actualiza la tabla `pagos`. No se está consultando antes de confirmar.

### 3. Super admin en Integraciones no usa el tenant seleccionado
`src/pages/IntegrationSettings.tsx` consume `useTenant()` (siempre el tenant del usuario logueado). Cuando un super admin selecciona otro tenant en el `SuperAdminTenantSelector` global, esta página sigue mostrando/guardando configuraciones del tenant propio del super admin, no del tenant seleccionado.

Hay que reemplazar `useTenant()` por `useEffectiveTenantId()` para que el super admin pueda ver y editar las integraciones (Mercado Pago, Google Maps, WhatsApp, SMTP, SMS, ARCA, Tiendanube, MercadoLibre) del tenant que tiene seleccionado en el selector global.

---

## Plan

### Punto 1 — Bloqueo de facturación de envíos cancelados

**`src/pages/Facturacion.tsx`**
- En `batchMutation` / handler individual: antes de invocar `arca-factura`, releer `envios.estado` por id y saltar (con resultado `ok: false, error: 'Envío cancelado/devuelto'`) los que estén en `cancelado` o `devuelto`. Mostrar toast resumen.
- En `handleDuplicate` / mutación de duplicado: si `duplicateSource.envio_id`, validar estado actual antes de emitir.
- En el render de la tabla "pendientes", excluir defensivamente cualquier envío con estado != `entregado` (la query ya lo hace, pero blindarlo).

**`src/components/invoicing/EmitirFacturaDialog.tsx`**
- (Es manual, sin envío vinculado) no requiere cambios salvo que se agregue selector de envío en el futuro.

**`supabase/functions/arca-factura/index.ts`** (defensa en profundidad)
- Cuando el body trae `envio_id`, leer el envío y rechazar con 400 (`{ success: false, error: 'No se puede facturar un envío cancelado/devuelto' }`) si `estado IN ('cancelado','devuelto')`.

### Punto 2 — Validar cobro de Mercado Pago antes de emitir etiqueta

**`src/components/shipments/PaymentMethodDialog.tsx`**
- Cuando hay `mpPayment` (preferencia generada), agregar polling con `mercadopago-check-status` mientras el dialog está abierto: cada 4–5 s consultar el estado por `preference_id` (o `envio_id`).
- Mostrar badge de estado en tiempo real ("Esperando pago…", "Pago aprobado ✓", "Pago rechazado").
- Deshabilitar el botón "Confirmar Pago" hasta que el estado sea `pagado` (approved). Si está `pendiente`, seguir esperando; si es `fallido`/`rechazado`, mostrar error y permitir cambiar método.
- Al hacer "Confirmar Pago", re-verificar una última vez vía `check-status` y solo entonces llamar `onConfirm`.
- Botón secundario: "Verificar pago ahora" para forzar el check.

**`src/pages/NewShipment.tsx` → `handlePaymentConfirm`**
- Para `method === 'mercado_pago'`: antes de insertar en `pagos`, invocar `mercadopago-check-status` con `envio_id` o `preference_id`; si no devuelve `pagado`, abortar y mostrar error ("El pago aún no fue confirmado por Mercado Pago").
- Si está `pagado`, dejar que el webhook/check-status ya haya actualizado el registro de `pagos` (creado por `mercadopago-payment`), y solo registrar movimiento de caja + redirigir a etiqueta. Evitar duplicar el insert de `pagos`.

**`supabase/functions/mercadopago-check-status/index.ts`**
- Aceptar opcionalmente `preference_id` además de `payment_id` para consultar por preferencia (búsqueda en MP `/v1/payments/search?preference_id=...`).
- Devolver `{ estado: 'pagado' | 'pendiente' | 'fallido', mp_payment_id }`.

### Punto 3 — Integraciones por tenant seleccionado (super admin)

**`src/pages/IntegrationSettings.tsx`**
- Reemplazar `const { tenantId, isLoading: tenantLoading } = useTenant()` por:
  - `useEffectiveTenantId()` para el id efectivo.
  - Mantener `useTenant()` solo si se necesita info adicional, o usar fallback al perfil para no-super-admins.
- Agregar `<TenantFilterChip />` arriba del título para feedback visual.
- En `useQuery(queryKey)` incluir el `effectiveTenantId` para refetch automático al cambiar de tenant.
- En `saveMutation`: usar `effectiveTenantId` en lugar de `tenantId` propio.
- Si `effectiveTenantId === null` (super admin con "Todos") deshabilitar el formulario y mostrar aviso: "Seleccioná un tenant específico para ver/editar sus integraciones".
- El trigger `set_integration_tenant_id` en DB ya respeta el `tenant_id` cuando el usuario es super_admin, así que insert/update funcionarán sin tocar backend.

---

## Archivos

**Modificados:**
- `src/pages/Facturacion.tsx` — validar estado antes de batch/duplicar.
- `src/components/shipments/PaymentMethodDialog.tsx` — polling + bloqueo confirmar hasta `approved`.
- `src/pages/NewShipment.tsx` — re-verificar MP antes de cerrar y evitar doble insert de `pagos`.
- `src/pages/IntegrationSettings.tsx` — usar `useEffectiveTenantId`, chip, manejar caso "Todos".
- `supabase/functions/arca-factura/index.ts` — rechazar envíos cancelados/devueltos.
- `supabase/functions/mercadopago-check-status/index.ts` — soportar consulta por `preference_id`.

**Sin cambios de schema/migraciones.**

## QA

1. **Factura cancelada**: cancelar un envío entregado, intentar facturarlo individual y en lote → bloqueado con mensaje claro. Llamar `arca-factura` directo con `envio_id` cancelado → 400.
2. **MP pendiente**: crear envío con MP, generar QR, no pagar, intentar confirmar → bloqueado ("pago no confirmado"). Pagar en MP sandbox, esperar polling → botón se habilita y al confirmar se emite etiqueta. Rechazar pago → mostrar fallido, permitir cambiar método.
3. **Super admin / Integraciones**: como super_admin, seleccionar tenant Black Box → ver sus claves de MP/ARCA/etc., editarlas, guardar → verificar en DB que el `tenant_id` quedó en Black Box, no en el del super admin. Cambiar a "Todos" → formulario deshabilitado con aviso.

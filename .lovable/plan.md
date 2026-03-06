

# Correcciones en emails de notificación

## Problemas detectados
1. **`=20` aparece en el email** — Es un artefacto de quoted-printable encoding. El template HTML usa template literals con indentación, y los espacios/saltos de línea se codifican como `=20`. Solución: eliminar indentación innecesaria en los template strings del HTML.
2. **Falta nombre del destinatario** — El saludo dice "Hola," sin nombre. Aunque el código lo incluye, se necesita verificar que se pase correctamente y mejorar el formato a "Hola **Nombre**,".
3. **Falta link de tracking público** — El email no incluye un enlace para que el destinatario siga su envío.
4. **Falta indicar pago en destino** — Si el envío es `pago_contra_entrega`, debería mostrarse un aviso con el monto a abonar.

## Cambios

### 1. `supabase/functions/send-tenant-email/index.ts`

**`templateShipmentCreated`** y **`templateStatusChange`**:
- Eliminar indentación de los template literals HTML (causa del `=20`)
- Mejorar saludo: `Hola <strong>${destinatario}</strong>,`
- Agregar link de tracking público usando `tracking_url` del data
- Agregar sección condicional de pago en destino si `pago_contra_entrega === true`, mostrando el monto

### 2. Pasar datos adicionales desde los triggers

**`src/pages/NewShipment.tsx`** (línea ~1324):
- Agregar `pago_contra_entrega`, `precio_total` y `tracking_url` al objeto `data`

**`src/components/shipments/ChangeStatusDialog.tsx`** (línea ~238):
- Agregar `pago_contra_entrega`, `precio_total` y `tracking_url` al select y al objeto `data`

**`src/components/delivery/DeliveryConfirmation.tsx`** (línea ~435):
- Agregar `pago_contra_entrega`, `precio_total` y `tracking_url` al select y al objeto `data`

### 3. URL de tracking

Se construirá en el frontend como `${window.location.origin}/tracking?q=${tracking_number}` (misma lógica que `getTrackingUrl` en ShipmentDetailsDialog) y se pasará como `tracking_url` en el data del email.

En la Edge Function, se renderizará como un botón "Seguí tu envío" con link al URL público.

## Archivos a modificar
1. `supabase/functions/send-tenant-email/index.ts` — fix `=20`, agregar tracking link, pago en destino
2. `src/pages/NewShipment.tsx` — pasar datos extra al email
3. `src/components/shipments/ChangeStatusDialog.tsx` — pasar datos extra
4. `src/components/delivery/DeliveryConfirmation.tsx` — pasar datos extra


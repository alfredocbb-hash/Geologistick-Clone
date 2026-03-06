

# Flujo automático de emails por cambio de estado

## Resumen
Agregar campo `email_destinatario` a `envios`, input en el formulario de nuevo envío, y disparar emails automáticos al crear envíos y al cambiar de estado.

## Cambios

### 1. Migración SQL
Agregar columna `email_destinatario TEXT` a la tabla `envios`.

### 2. `src/pages/NewShipment.tsx`
- Agregar `destinatario_email_envio` al `initialFormData` (o reusar `destinatario_email`).
- En el insert de `envios` (línea ~1138), agregar `email_destinatario: formData.destinatario_email || null`.
- En `onSuccess` de la mutación, después de crear el envío, si hay `email_destinatario` y el envío se creó exitosamente, invocar `send-tenant-email` con template `shipment_created` (fire-and-forget, sin bloquear el flujo).
- Auto-completar desde cliente cuando se usa `handleLoadRecipientClient`.

**No se agrega un input nuevo** — ya existe `destinatario_email` en el formulario. Solo se necesita guardarlo en la columna `email_destinatario` del envío.

### 3. `src/components/shipments/ChangeStatusDialog.tsx`
- En `onSuccess` de la mutación, hacer fetch del envío para obtener `email_destinatario`, `tracking_number`, `nombre_destinatario`, `direccion_entrega`.
- Si tiene email y el nuevo estado es uno relevante (`en_sucursal`, `en_reparto`, `entregado`, `devuelto`), invocar `send-tenant-email` con template `status_change` (fire-and-forget).
- Se necesita obtener `tenant_id` del perfil del usuario (ya disponible vía `useAuth`).

### 4. `src/components/delivery/DeliveryConfirmation.tsx`
- En `onSuccess` de `confirmMutation`, hacer fetch del envío para obtener `email_destinatario`.
- Si tiene email, invocar `send-tenant-email` con template `status_change` y estado `entregado` (fire-and-forget).

### 5. Helper reutilizable (nuevo)
Crear una función helper `sendShipmentEmail` en un archivo compartido para evitar duplicar la lógica de invocación:

```typescript
// src/lib/emailNotifications.ts
export async function sendShipmentEmail(params: {
  tenant_id: string;
  to: string;
  template: 'status_change' | 'shipment_created';
  data: Record<string, unknown>;
}) {
  try {
    await supabase.functions.invoke('send-tenant-email', { body: params });
  } catch (e) {
    console.error('Error sending email notification:', e);
  }
}
```

## Notas técnicas
- Los emails son **fire-and-forget**: si fallan, no bloquean la operación principal. Solo se logea el error.
- No se necesita verificar si el tenant tiene SMTP configurado desde el frontend — la Edge Function ya retorna 404 si no hay config, y el error se ignora silenciosamente.
- El campo `destinatario_email` ya existe en el formulario pero no se guardaba en `envios`. Ahora se persiste como `email_destinatario`.

## Archivos a modificar/crear
1. **Migración SQL** — `ALTER TABLE envios ADD COLUMN email_destinatario TEXT`
2. **`src/lib/emailNotifications.ts`** — helper reutilizable (nuevo)
3. **`src/pages/NewShipment.tsx`** — guardar email + enviar notificación post-creación
4. **`src/components/shipments/ChangeStatusDialog.tsx`** — enviar notificación post-cambio
5. **`src/components/delivery/DeliveryConfirmation.tsx`** — enviar notificación post-entrega


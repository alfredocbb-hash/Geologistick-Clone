

## Plan: Componente inteligente de teléfono con auto-formato WhatsApp

### Resumen
Crear un componente `PhoneInput` reutilizable que automáticamente normalice números argentinos para WhatsApp. Unificar los campos "Teléfono" y "WhatsApp" en uno solo en el formulario de nuevo envío.

### Cambios

**1. Nuevo componente `src/components/ui/phone-input.tsx`**
- Input con ícono de WhatsApp integrado
- On blur: auto-formatea el número usando la lógica existente de `cleanPhoneNumber` (csvParser.ts)
  - `11 1234-5678` → `+5411 1234-5678`
  - `011 1234-5678` → `+5411 1234-5678`
  - `15 1234-5678` → `+54911 1234-5678`
  - `+54...` → se deja como está
- Muestra badge visual verde "✓ WhatsApp" cuando el número está bien formateado
- Prefijo `+54` mostrado como addon visual fijo a la izquierda (el usuario solo tipea el número local)
- Props compatibles con Input estándar (`value`, `onChange`, `className`, etc.)

**2. Modificar `src/pages/NewShipment.tsx`**
- Eliminar campo separado `destinatario_whatsapp` del form
- Reemplazar el input de `destinatario_telefono` por `PhoneInput`
- Al guardar, usar el teléfono formateado como `whatsapp_destinatario` también
- Hacer lo mismo con `remitente_telefono`

**3. Reutilizar en otros formularios**
- El componente queda disponible globalmente para uso en Users, Onboarding, Profile, etc.

### Archivos
- **Crear**: `src/components/ui/phone-input.tsx`
- **Modificar**: `src/pages/NewShipment.tsx` (unificar campos, usar PhoneInput)


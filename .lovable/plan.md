

## Plan: Validar largo mínimo de teléfonos antes de guardar

### Causa raíz
La función `formatArgentinaPhone` en `src/components/ui/phone-input.tsx` agrega el prefijo `+54` a cualquier input sin importar su largo. El formulario de nuevo envío no valida que el teléfono sea válido antes de crear el cliente y el envío. Por eso `"1"` → `"+541"`.

### Cambios

**`src/components/ui/phone-input.tsx`**:
- En `formatArgentinaPhone`: si después de limpiar el número tiene menos de 6 dígitos, retornar el string tal cual (sin agregar `+54`). Esto evita que inputs basura se "legitimen" con el prefijo.

**`src/pages/NewShipment.tsx`**:
- Antes de llamar a `findOrCreateClient` para el destinatario, validar que el teléfono tenga al menos 10 dígitos (usando `isValidArgentinePhone` o un check inline). Si no es válido, lanzar error con mensaje claro: "El teléfono del destinatario no es válido".
- Aplicar la misma validación para el remitente.

**`src/components/routes/ThirdPartyShipmentsTab.tsx`**:
- Agregar validación similar en `validateForm()` para el teléfono del destinatario.

### Impacto
- Previene la creación de clientes con teléfonos inválidos como `+541`
- La normalización onBlur sigue funcionando igual para números válidos
- El indicador ✓ verde ya muestra correctamente que el número es inválido (≥10 dígitos)

| Archivo | Cambio |
|---------|--------|
| `phone-input.tsx` | `formatArgentinaPhone` retorna sin prefijo si < 6 dígitos |
| `NewShipment.tsx` | Validar teléfono destinatario/remitente antes de guardar |
| `ThirdPartyShipmentsTab.tsx` | Validar teléfono en `validateForm()` |

No se requiere migración de base de datos. Para corregir el dato existente de ENV-N54JPN, se puede actualizar manualmente el teléfono del cliente.


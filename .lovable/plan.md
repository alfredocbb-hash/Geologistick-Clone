

## Plan: Incorporar PhoneInput en el resto del proyecto

### Resumen
Reemplazar todos los campos de teléfono que usan `<Input type="tel">` o `<Input>` plano por el nuevo componente `PhoneInput` con auto-formato WhatsApp.

### Archivos a modificar

**1. `src/components/profile/PersonalInfoCard.tsx`**
- Reemplazar `<Input id="telefono" type="tel">` por `<PhoneInput>`
- Adaptar onChange: de `(e) => setFormData({...formData, telefono: e.target.value})` a `(v) => setFormData({...formData, telefono: v})`

**2. `src/components/ecommerce/CreateSellerDialog.tsx`**
- En el FormField `name="telefono"`, reemplazar `<Input {...field} />` por `<PhoneInput value={field.value} onChange={field.onChange} />`

**3. `src/components/ecommerce/EditSellerDialog.tsx`**
- Mismo cambio que CreateSellerDialog: reemplazar Input por PhoneInput en el campo telefono

### Sin cambios en backend
Solo cambios de componente UI. La lógica de formularios y guardado permanece igual.


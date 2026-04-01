

## Plan: Agregar toggle "Modo Flex Mixto" al diálogo de edición de tenant

### Problema
La columna `modo_flex_mixto` existe en la base de datos y el código la lee en `MobileAppLayout`, pero falta el toggle en el formulario de edición de empresa para poder activarla.

### Cambios en `src/components/tenants/EditTenantDialog.tsx`

1. **Agregar estado** `modoFlexMixtoEnabled` (junto a los otros, línea ~51):
   ```ts
   const [modoFlexMixtoEnabled, setModoFlexMixtoEnabled] = useState((tenant as any).modo_flex_mixto ?? false);
   ```

2. **Reset en useEffect** (línea ~83, junto a los otros resets):
   ```ts
   setModoFlexMixtoEnabled((tenant as any).modo_flex_mixto ?? false);
   ```

3. **Incluir en el update** del `onSubmit` (línea ~109):
   ```ts
   modo_flex_mixto: modoFlexMixtoEnabled,
   ```

4. **Agregar toggle en el UI** después del toggle "Modo Flex" (línea ~326):
   ```tsx
   <div className="flex items-center justify-between rounded-lg border p-4">
     <div>
       <Label className="text-base font-medium">Modo Flex Mixto</Label>
       <p className="text-sm text-muted-foreground">
         Habilita fallback OCR cuando el seller no está autorizado en ML
       </p>
     </div>
     <Switch 
       checked={modoFlexMixtoEnabled} 
       onCheckedChange={setModoFlexMixtoEnabled}
       disabled={!modoFlexEnabled}
     />
   </div>
   ```
   El toggle se deshabilita si "Modo Flex" no está activo (ya que Flex Mixto es una extensión de Flex).

### Archivo a modificar
- `src/components/tenants/EditTenantDialog.tsx`


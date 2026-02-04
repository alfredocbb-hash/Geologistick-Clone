

# Plan: Habilitar botón "Llamar" en la APK del chofer

## ✅ COMPLETADO

### Cambios Realizados en `ActiveRouteNavigation.tsx`:

1. **Agregado `whatsapp_destinatario` a las queries** (líneas 141 y 178)
2. **Nueva lógica de teléfono con fallback** (línea 447-452):
   - `phone = contact?.telefono || whatsapp_destinatario`
3. **Botones actualizados** (líneas 614-628):
   - Ahora usan `phone` y `clienteName` en lugar de `contact?.telefono`

### Resultado
Los botones "Llamar" y "WhatsApp" ahora funcionan para envíos importados que no tienen cliente vinculado pero sí tienen `whatsapp_destinatario`.

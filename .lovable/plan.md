

## Diagnóstico: Error 401 al registrar envío ML

### Lo que está pasando

El error 401 es **esperado y correcto**. Cuando escaneás un envío de un seller que no está registrado en el sistema, la función intenta usar la "cuenta logística" (FULLIMPORT, ML user 293662607) para consultar los datos del envío. Pero MercadoLibre rechaza la consulta porque esa cuenta no tiene autorización para ver envíos del seller 1698401281.

```text
Flujo actual:
QR scan → sender_id 1698401281 no registrado → fallback a cuenta logística (293662607) → ML API rechaza: "Invalid caller.id" → 401
```

### Lo que debería pasar

Después del error 401, el `MLRegisterDialog` muestra:
1. El mensaje de error descriptivo
2. El botón **"Usar OCR (foto de etiqueta)"** (porque `modo_flex_mixto = true` en tu tenant)

Al hacer click en "Usar OCR", se abre el `OCRCaptureDialog` donde tomás la foto de la etiqueta y se crea el envío manualmente.

### Posible problema a investigar

Si el botón "Usar OCR" **no aparece** después del error, puede ser porque `supabase.functions.invoke` está poniendo la respuesta de error en `data` en vez de `fnError` (depende de la versión del cliente). En ese caso:

- Línea 101 de `MLRegisterDialog.tsx`: `if (data?.error)` lanza el error pero no pasa por el path que setea `setError()` correctamente — sí lo hace, ya que cae en el `catch` de línea 110.

### Plan de verificación

No hay un bug de código evidente. El flujo está correctamente conectado. Te sugiero:

1. Hacer click en **"Registrar Envío"** en el dialog
2. Esperar el error 401
3. Verificar que aparece el botón naranja **"Usar OCR (foto de etiqueta)"**
4. Hacer click y tomar la foto
5. Confirmar los datos → el envío se crea con tracking `OCR-{timestamp}`

Si el botón OCR **no aparece**, el fix sería asegurar que `data?.error` también active el estado de error y muestre el fallback. Si aparece y todo funciona, el 401 es simplemente el paso previo esperado antes de usar OCR.

### Si querés que el 401 no sea visible al usuario

Se puede cambiar el flujo para que cuando el seller no esté registrado, se salte directamente al OCR sin intentar llamar a la API de ML. Esto evitaría la demora y el mensaje de error. El cambio sería:

**`src/components/scan/MLRegisterDialog.tsx`**: Si el lookup del seller falla (no se encuentra en `ecommerce_sellers`) y hay `onFallbackOCR`, ir directo al OCR sin intentar registrar vía API.

### Archivos a modificar
- `src/components/scan/MLRegisterDialog.tsx` — Auto-redirect a OCR cuando no hay seller directo y `onFallbackOCR` está disponible




## Plan: Mejorar UX de confirmación OCR — evitar confusión "detectado vs guardado"

### Problema
El OCR detectó correctamente el envío 46236169153 y mostró el toast "Envío ML detectado: 46236169153". Pero el envío **nunca se guardó** en la base de datos porque el usuario no presionó "Confirmar" en la pantalla de edición. El toast da la impresión de que el envío ya fue registrado.

### Solución
Dos cambios para eliminar la confusión:

1. **Cambiar el texto del toast** de "Envío ML detectado" a algo que indique claramente que falta confirmar, como "Datos extraídos — revisá y confirmá".

2. **Auto-confirmar cuando todos los campos obligatorios están presentes**: Si el OCR extrajo al menos dirección + (localidad o CP), ejecutar automáticamente `handleConfirm()` sin requerir clic manual. El usuario verá directamente la pantalla de éxito con el tracking. Si faltan campos, sí mostrar la pantalla de edición.

### Archivos a modificar
- `src/components/mobile/OCRCaptureDialog.tsx` — cambiar toast y agregar auto-confirm cuando la extracción es completa


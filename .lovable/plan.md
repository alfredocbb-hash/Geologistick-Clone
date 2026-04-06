

## Plan: Fix botones desaparecen con muchas fotos + Edición manual de fotos con error

### Problema 1: Botones desaparecen
La vista de álbum usa `flex flex-col` con `overflow-hidden`. El `ScrollArea` controla el scroll de las fotos, pero los botones de acción (PROCESAR, PLANIFICAR) están **fuera** del ScrollArea en un div normal. Con muchas fotos, el contenedor no tiene espacio y los botones quedan ocultos debajo del viewport sin posibilidad de scroll.

### Problema 2: Fotos sin dirección no se pueden corregir
Cuando el OCR falla por falta de dirección, la foto queda en estado `error` y solo se puede ver el mensaje de error. No hay forma de agregar manualmente los datos faltantes.

---

### Solución

**`src/components/mobile/BulkOCRScreen.tsx`** — Dos cambios:

**1. Botones siempre visibles (fixed bottom):**
- Mover la sección de botones de acción a un div con `fixed bottom-0 left-0 right-0` (o `sticky bottom-0`) para que siempre estén visibles independientemente de cuántas fotos haya
- Ajustar el padding inferior del grid de fotos para que no queden tapadas por los botones fijos
- Agregar barra de progreso visible durante el procesamiento

**2. Edición manual de fotos con error:**
- Agregar un botón "Editar" en cada foto con estado `error` que abre un mini-formulario (Dialog) donde el usuario puede ingresar manualmente: dirección, localidad, código postal, nombre destinatario, teléfono, remitente
- Al confirmar, se crea el envío en la DB con los datos manuales y la foto pasa a estado `saved`
- Reutilizar la misma lógica de insert que `processOnePhoto` pero con datos del formulario en vez de OCR

### Archivos a modificar
- `src/components/mobile/BulkOCRScreen.tsx` — Layout fixed para botones + dialog de edición manual para fotos con error


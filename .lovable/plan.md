

## Plan: Card de Colectas siempre visible + Historial por fecha

### Diagnóstico
El envío `MDC-1145-R-00000208` sigue en estado `pendiente` sin `chofer_id` — la colecta no se confirmó. Esto es porque la APK aún no tiene el fix que conecta el OCR masivo con la lista de colecta (el cambio de `onPackagesReady` que aprobaste antes). Una vez actualizada la APK, el flujo funcionará correctamente.

### Cambios solicitados

**1. Card de Colectas siempre visible en Home (`MobileHomeTab.tsx`)**
- Quitar la condición `(todayColectas?.totalPaquetes ?? 0) > 0` que oculta la card
- Mostrar siempre la card con "0 paquetes" si no hay colectas hoy

**2. Historial de Colectas por fecha (`MobileHistoryTab.tsx`)**
- En la pestaña "Colectas", agrupar las colectas por fecha (día)
- Mostrar un encabezado con la fecha y la cantidad total de paquetes ese día
- Debajo, listar cada colecta individual con hora, cantidad y fuente
- Aumentar el límite de 30 a 100 para tener más historial

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/mobile/MobileHomeTab.tsx` | Quitar condición que oculta la card de colectas |
| `src/components/mobile/MobileHistoryTab.tsx` | Agrupar colectas por fecha con totales diarios |

### Nota
Para que las colectas realmente se registren, necesitás actualizar la APK con los cambios anteriores del `onPackagesReady`.


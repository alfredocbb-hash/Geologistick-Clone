

## Plan: Corregir registro de envíos ML Flex en ambos modos de escaneo

### Problema 1 — Modo Flex: escanea pero no hace nada
En `FlexScanScreen.tsx`, cuando se escanea un QR de ML y el envío no está registrado, el código solo muestra un toast de advertencia (línea 86) pero **nunca establece `mlRegisterData`**, por lo que el `MLRegisterDialog` nunca se abre. El estado `mlRegisterData` existe (línea 45) y el dialog está renderizado (línea 366), pero la conexión entre el escaneo fallido y la apertura del dialog está rota.

### Problema 2 — Modo normal: no detecta la cuenta logística
En `MLRegisterDialog.tsx`, la función `lookupLogisticsAccount` consulta `profiles` y `ecommerce_sellers` desde el frontend. Hay dos posibles causas:
- El chofer puede no tener acceso RLS para leer `ecommerce_sellers` filtrado por `access_token`
- La query usa `.not('access_token', 'is', null)` que requiere visibilidad del campo

### Cambios

**1. `src/components/mobile/FlexScanScreen.tsx`**
- En `handleQRScanned`, cuando un ML shipment no se encuentra (`!added`), cerrar el scanner y abrir el `MLRegisterDialog` estableciendo `mlRegisterData` con el `shipmentId` y `senderId` del QR parseado
- Flujo: escaneo → no encontrado → cierra scanner → abre MLRegisterDialog → si registra exitosamente → agrega paquete a la lista

**2. `src/components/scan/MLRegisterDialog.tsx`**
- Hacer la búsqueda de cuenta logística más robusta: quitar el filtro `.not('access_token', 'is', null)` del frontend (el chofer probablemente no tiene visibilidad de ese campo por RLS)
- En su lugar, buscar solo por `es_cuenta_logistica = true`, `activo = true`, y `plataforma = 'mercadolibre'` — la validación del token se hará en la Edge Function al momento de registrar

### Archivos a modificar
- `src/components/mobile/FlexScanScreen.tsx` — conectar escaneo fallido con MLRegisterDialog
- `src/components/scan/MLRegisterDialog.tsx` — quitar filtro de access_token en lookupLogisticsAccount


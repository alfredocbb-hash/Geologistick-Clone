# Plan: Agregar Opción "Recibir Hoja de Ruta" en la APK

## ✅ IMPLEMENTADO

### Cambios Realizados

1. **Importaciones** - Agregados `ReceiveRouteSheetDialog`, `CollectRouteSheetDialog` y ícono `Building2`

2. **Estados** - Nuevos estados para manejar hojas de ruta:
   - `showReceiveRouteSheetDialog` 
   - `showCollectRouteSheetDialog`
   - `scannedRouteSheetId`

3. **Lógica de escaneo** - Cuando se detecta `route_sheet`:
   - Valida que la hoja de ruta exista en BD
   - Si el usuario es **chofer** → abre `CollectRouteSheetDialog`
   - Si es **admin/operador/sucursal** → abre `ReceiveRouteSheetDialog`

4. **UI** - Nueva tarjeta "Recibir" visible para roles administrativos:
   - Grid ahora es 3 columnas para admin/operador
   - Mantiene 2 columnas para choferes

5. **Diálogos** - Agregados ambos diálogos al render del componente

## Resultado

- ✅ Al escanear una Hoja de Ruta como administrador → se abre el diálogo de recepción masiva
- ✅ Al escanear una Hoja de Ruta como chofer → se abre el diálogo de recolección
- ✅ Nueva tarjeta "Recibir" visible solo para roles de sucursal/operador
- ✅ Escaneo de envíos individuales sigue funcionando igual

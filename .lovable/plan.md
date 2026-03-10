

# Agregar tipo de operación en detalle y print de liquidaciones terciarizados

## Contexto
Los envíos terciarizados no usan `tipo_servicio_detalle` como referencia. El campo relevante es `requiere_retiro` (boolean en tabla `envios`):
- `requiere_retiro = true` → **Retiro**
- `requiere_retiro = false/null` → **Entrega**

Esto coincide con el `TIPO_OPERACION` usado en `ThirdPartyShipmentsTab`.

## Cambios

### 1. `src/components/settlements/ThirdPartySettlementDetailDialog.tsx`
- Agregar `requiere_retiro` al select de envíos (línea ~65, dentro del join a `envios`)
- Agregar columna "Operación" en la tabla de envíos entre "Tracking" y "Destinatario"
- Mostrar badge "Retiro" o "Entrega" según `requiere_retiro`

### 2. `src/pages/PrintSettlement.tsx`
- Para `type=third-party`, agregar `requiere_retiro` al select de envíos
- Agregar columna "Operación" en la tabla de impresión
- Renderizar "Retiro" o "Entrega" según el valor

### 3. `src/lib/generateSettlementPDF.ts`
- En `downloadThirdPartySettlementPDF`, agregar `requiere_retiro` al select
- Agregar columna "Operación" en la tabla del PDF con el label correspondiente


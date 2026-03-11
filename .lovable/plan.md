

# Visibilidad de envíos recibidos en liquidación de sucursal

## Diagnóstico

El motor de cálculo **ya incluye** los envíos recibidos por la sucursal (donde `sucursal_destino_id = sucursal`). Aplica comisiones de recepción cuando el envío está entregado. La consulta usa `.or(sucursal_origen_id.eq.X,sucursal_destino_id.eq.X)`.

Revisando los datos de Berazategui, la liquidación actual solo muestra envíos de emisión porque **no hay envíos entregados con destino a esa sucursal** en el período seleccionado (solo 2 en total histórico en la sucursal correcta).

**El problema real es de transparencia**: el operador de la sucursal no puede distinguir en el detalle cuáles envíos son de emisión y cuáles de recepción, ni verificar que ambos tipos están incluidos.

## Plan de cambios

### 1. Agregar columna `rol` a `liquidacion_sucursal_detalles`
- Migración: `ALTER TABLE liquidacion_sucursal_detalles ADD COLUMN rol text DEFAULT 'emision'`
- Valores posibles: `'emision'` o `'recepcion'`

### 2. Guardar el rol al crear detalles (`BranchSettlements.tsx`)
- En el `calculateMutation`, al construir `enviosData`, determinar y guardar si cada envío es origen o destino
- Un envío puede generar DOS filas de detalle si es origen Y destino de la misma sucursal (caso intra-sucursal)
- En el `saveMutation`, incluir el campo `rol` en cada detalle insertado

### 3. Mostrar el rol en el detalle (`SettlementDetailDialog.tsx`)
- Agr
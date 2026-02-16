

# Ocultar Movimientos en Liquidaciones de Sellers (Ecommerce)

## Resumen

Se eliminara la seccion/tab de "Movimientos" de la pagina de Liquidaciones de Sellers (`src/pages/ecommerce/Settlements.tsx`). Los movimientos de cuenta corriente seguiran existiendo en la base de datos pero no se mostraran al usuario en esta pantalla.

## Cambios

### 1. `src/pages/ecommerce/Settlements.tsx`

**Tab principal "Movimientos" (linea 974):**
- Eliminar el `TabsTrigger value="movements"` del TabsList principal (dejar solo "Saldos por Seller" y "Liquidaciones")
- Eliminar todo el `TabsContent value="movements"` (lineas ~1054-1132) que contiene la tabla de movimientos con filtros

**Preview de calculo de liquidacion (lineas ~1310-1361):**
- Eliminar el tab "Movimientos Cta. Cte." del preview de pre-liquidacion
- Mostrar directamente la tabla de envios sin tabs (ya que solo queda una seccion)
- Eliminar la card "Movimientos Cta." del resumen de totales (linea 1280-1283)

**Query de movimientos (linea ~160-190 aprox):**
- Eliminar la query `useQuery` que carga los movimientos de `seller_cuenta_corriente` para el tab principal
- Eliminar el estado `filteredMovements` y variables relacionadas con el filtro de movimientos

**Calculo de liquidacion:**
- Mantener la logica de calculo de movimientos internamente (se siguen vinculando a la liquidacion) pero no mostrarlos en la UI
- Ajustar los mensajes toast para no mencionar "movimientos"

**Generacion de liquidacion:**
- Mantener el vinculo de movimientos en la generacion (lineas 738-746) ya que es logica de negocio necesaria
- Ajustar la validacion para que permita generar si hay envios aunque no haya movimientos

**Estados y variables a limpiar:**
- `search` y `selectedSeller` (usados solo para filtrar movimientos) - evaluar si se usan en otro lado
- `previewTab` state - ya no necesario si solo hay envios
- Interface `Movement` y query de movements del tab principal

### 2. Mensajes y textos
- Cambiar "No hay movimientos ni envios sin liquidar" por "No hay envios sin liquidar en el periodo seleccionado"
- Cambiar "No hay movimientos ni envios para liquidar" por "No hay envios para liquidar"
- Cambiar texto del dialogo de cancelacion que menciona "movimientos y envios"



# Plan: Opción para Multiplicar Flete Base por Bultos

## Estado: ✅ COMPLETADO

## Cambios Realizados

### 1. ✅ Migración de Base de Datos
- Columna `multiplicar_flete_por_bultos` agregada a tabla `tarifas`

### 2. ✅ Rates.tsx
- Interface Tarifa actualizada con nuevo campo
- FormData incluye el campo
- Switch agregado en formulario de tarifa
- Badge "×Bultos" visible en tarjetas de tarifa activas
- Reset y edit manejan el nuevo campo

### 3. ✅ NewShipment.tsx
- Cálculo de flete multiplicado por cantidad de bultos si está activo
- Descripción del flete muestra "× N bultos" cuando aplica
- Variable `multiplicadoPorBultos` disponible para UI

### 4. ✅ Edge Function (tiendanube-shipping-rates)
- Interface TarifaData actualizada
- Query incluye nuevo campo
- Función `calculateRate` recibe y usa `itemCount`
- Multiplicación aplicada al precio base si está configurado

### 5. ✅ PDF Documentation
- Sección 3 actualizada con nuevo Paso 5
- Ejemplo práctico muestra cálculos con múltiples bultos


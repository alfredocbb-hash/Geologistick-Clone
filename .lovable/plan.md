
# Correcciones y mejoras al sistema de Tarifas

## Problemas identificados y soluciones

### 1. Seguro no se detecta (Bug critico)
**Problema**: El codigo busca `codigo === "seguro"` pero los tenants usan codigos como `"BE-SEGURO"`. Por eso el toggle %/$ nunca aparece y el seguro no se calcula.

**Solucion**: Cambiar todas las comparaciones a busqueda por subcadena (`codigo.includes("seguro")`) en:
- `src/components/rates/CreateTarifaWizard.tsx` (linea 357)
- `src/components/rates/TarifaSandbox.tsx` (linea 146)
- `src/pages/Rates.tsx` (lineas 714 y 1370)

### 2. Flete duplicado en detalles del envio
**Problema**: Al guardar un envio, se crea una linea "Flete" con el monto calculado (correcto). Pero si existe un concepto "BE-FLETE" con monto $0, puede generar confusion visual en el recibo.

**Solucion**: En `src/pages/NewShipment.tsx` (linea 1096-1102), agregar la exclusion del concepto Flete no solo por `codigo === 'flete'` sino tambien por subcadena (`codigo.includes('flete')`), para que `BE-FLETE` tambien se excluya correctamente del detalle (ya que el flete calculado lo cubre).

### 3. Sandbox no simula rangos escalonados
**Problema**: La calculadora `TarifaSandbox.tsx` solo usa el metodo simple (base + adicional/kg) pero ignora `rangos_kg` y el calculo por volumen que si usa `NewShipment.tsx`.

**Solucion**: Actualizar `simulateRate()` en `TarifaSandbox.tsx` para:
- Prioridad 1: Si hay `rangos_kg` configurados, buscar el rango aplicable
- Prioridad 2: Metodo simple (base + adicional/kg)
- Agregar input de dimensiones opcional para simular cobro por volumen
- Replicar la misma logica que `NewShipment.tsx` lineas 688-748

### 4. Campo express_surcharge no se persiste
**Problema**: El wizard permite configurar un recargo express pero el campo no existe en la tabla `tarifas`.

**Solucion**:
- Crear migracion para agregar columna `express_surcharge NUMERIC DEFAULT 0` a la tabla `tarifas`
- Actualizar `saveMutation` en `Rates.tsx` para incluir `express_surcharge` en el objeto `tarifaData`
- Actualizar la Edge Function `tiendanube-shipping-rates` para leer `express_surcharge` de la tarifa (ademas del seller)
- Actualizar `handleEdit` en `Rates.tsx` para cargar el campo al editar

## Detalle tecnico por archivo

### Migracion DB: agregar express_surcharge
```sql
ALTER TABLE tarifas ADD COLUMN express_surcharge NUMERIC DEFAULT 0;
```

### `src/components/rates/CreateTarifaWizard.tsx`
- Linea 357: Cambiar `concepto.codigo?.toLowerCase() === "seguro"` por `concepto.codigo?.toLowerCase().includes("seguro")`

### `src/components/rates/TarifaSandbox.tsx`
- Linea 146: Cambiar deteccion de seguro a subcadena
- Lineas 62-75: Agregar logica de rangos escalonados (prioridad sobre metodo simple):

```text
Si rangos_kg tiene datos Y peso > 0:
  1. Buscar rango donde peso >= desde Y peso <= hasta
  2. Si encuentra: usar rango.precio como flete
  3. Si no: usar ultimo rango (peso excedido)
Si no hay rangos_kg:
  Usar metodo simple (base + adicional/kg)
```

- Agregar input opcional de dimensiones (AxBxC cm) para simular cobro por volumen cuando el tipo es "peso" y hay umbral configurado

### `src/pages/Rates.tsx`
- Linea 714: Cambiar deteccion de seguro a subcadena
- Linea 1370: Cambiar deteccion de seguro a subcadena
- En `saveMutation` (linea ~292-312): Agregar `express_surcharge: parseFloat(data.express_surcharge || '0') || 0` al objeto `tarifaData`
- En `handleEdit` (linea ~634-677): Cargar `express_surcharge` del tarifa editada
- En `resetForm`: Agregar `express_surcharge: ''` al estado inicial

### `src/pages/NewShipment.tsx`
- Lineas 1098-1101: Cambiar la exclusion del concepto flete para usar subcadena:
```typescript
if (conceptoCode?.includes('flete') || conceptoName?.includes('flete')) {
  return; // ya incluido como flete calculado
}
```

### `supabase/functions/tiendanube-shipping-rates/index.ts`
- Linea 146: Agregar `express_surcharge` al select de tarifas
- Usar `tarifa.express_surcharge` como fallback si el seller no tiene configurado su propio surcharge

## Resumen de cambios
- **1 migracion DB**: agregar `express_surcharge` a `tarifas`
- **4 archivos frontend**: corregir deteccion seguro, flete duplicado, sandbox completo
- **1 edge function**: leer `express_surcharge` de tarifa
- **0 cambios de logica de guardado** (saveMutation solo se extiende con el nuevo campo)

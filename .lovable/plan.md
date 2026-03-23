

## Plan: Concepto "por día" multiplicado por días hábiles del período

### Problema
El concepto "Recargo por día" ($7.000) se aplica actualmente **por envío**. Debería aplicarse **por día hábil del período de liquidación** como cargo global del seller (ej: 5 días lun-vie × $7.000 = $35.000), independiente de la cantidad de envíos.

### Cambios

**1. Migración: agregar columna `multiplicar_por_dias` a `tarifa_concepto_precios`**
- Nuevo campo `boolean DEFAULT false` en la tabla `tarifa_concepto_precios`
- Cuando es `true`, el monto se multiplica por los días hábiles (lun-vie) del período de liquidación, no por envío

**2. UI de creación de concepto: `CreateSellerTarifaDialog.tsx`**
- Agregar un switch "Cobro por día (lun-vie)" al formulario de concepto adicional
- Cuando está activado, el monto se guarda con `multiplicar_por_dias: true`

**3. Motor de liquidación: `Settlements.tsx`**
- Separar conceptos en dos grupos:
  - **Per-envío** (comportamiento actual): se suman al precio de cada envío
  - **Per-día** (`multiplicar_por_dias = true`): se calculan una sola vez como cargo global del seller
- Calcular días hábiles (lun-vie) entre `fechaInicio` y `fechaFin` del período
- Mostrar el cargo por día como línea separada en los stats (ej: "Recargo por día: 5 días × $7.000 = $35.000")
- Sumar al `totalEnvios` o mostrarlo como cargo adicional en los totales

**4. Visualización en la tabla**
- No agregar el concepto "por día" a cada fila de envío (ya que no es per-envío)
- Mostrar un resumen arriba de la tabla: "Recargo por día: 5 días × $7.000 = $35.000"

**5. Incluir en la generación de liquidación**
- Sumar los cargos por día al `saldo_periodo` de la liquidación generada

### Detalle técnico

```text
Migración:
  ALTER TABLE tarifa_concepto_precios 
  ADD COLUMN multiplicar_por_dias boolean DEFAULT false;

Cálculo días hábiles:
  function countWeekdays(start: Date, end: Date): number {
    let count = 0;
    let d = new Date(start);
    while (d <= end) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  }

Separación en motor:
  conceptos con multiplicar_por_dias → se excluyen del loop per-envío
  Se calculan aparte: monto × countWeekdays(fechaInicio, fechaFin)
```

### Archivos a modificar
- `tarifa_concepto_precios` (migración)
- `src/pages/ecommerce/Settlements.tsx`
- `src/components/ecommerce/CreateSellerTarifaDialog.tsx`


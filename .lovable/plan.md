

## Plan: Incluir conceptos adicionales de tarifa en liquidaciones de seller

### Problema
Cuando un seller tiene una tarifa con conceptos adicionales configurados (ej: "Recargo por día"), el motor de liquidación solo usa el `precio_base` de la tarifa y **no consulta `tarifa_concepto_precios`**. Esto hace que el importe adicional no se refleje ni en el detalle ni en los totales.

### Cambios en `src/pages/ecommerce/Settlements.tsx`

**1. Fetch de conceptos adicionales**
Después de obtener las tarifas (zona y exclusivas), consultar `tarifa_concepto_precios` para **todas** las tarifa_ids encontradas. Solo sumar los conceptos marcados como `es_basico = true` (mismo criterio que `NewShipment.tsx` y `public-rates`).

**2. Sumar conceptos al precio calculado**
En el bloque donde se calcula `precioFinal` por zona/tarifa, después de asignar `precio_base`, sumar los montos de los conceptos básicos vinculados a esa tarifa. Para conceptos con `es_porcentaje = true`, calcular el porcentaje sobre el precio base. Para `multiplicar_por_bultos`, multiplicar por cantidad de bultos (1 por defecto en e-commerce).

**3. Agregar columna "Adicional" a la tabla de pre-visualización**
Mostrar el monto del concepto adicional sumado a cada envío (si lo tiene), junto al nombre del concepto. Esto le da visibilidad al usuario sobre qué compone el precio final.

**4. Actualizar la interfaz `CalculatedEnvio`**
Agregar campo `concepto_adicional: { nombre: string; monto: number } | null` para trackear el desglose.

### Detalle técnico

```text
Query nueva:
  tarifa_concepto_precios
    .select('tarifa_id, monto, es_porcentaje, porcentaje, multiplicar_por_bultos, 
             concepto:tarifa_conceptos(nombre, codigo, es_basico, activo)')
    .in('tarifa_id', allTarifaIds)

Cálculo:
  precioFinal = precio_base + Σ(conceptos_basicos_activos.monto)
  
Visualización:
  Columna "Adicional" → muestra nombre + monto si aplica
```

### Archivo a modificar
- `src/pages/ecommerce/Settlements.tsx`


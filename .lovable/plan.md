
# Plan de Solución: Bug de Recarga en NewShipment

## Diagnóstico del Problema

El usuario `Clientes@beraexpress.com` reporta que al cargar un envío, la página se **actualiza/recarga** antes de poder guardar, perdiendo todo el progreso.

### Causas Identificadas

Después de analizar el código, identifiqué **dos problemas principales**:

---

### 1. Cálculos Pesados en Cada Render

Las funciones `calcularPrecio()`, `calcularTotalConceptosBasicos()` y `calcularTotalConceptosAdicionales()` **se ejecutan en cada render** del componente (línea 1038):

```tsx
const precioCalculado = calcularPrecio();
```

Esto puede causar:
- **Re-renders excesivos** cada vez que el usuario escribe algo
- **Bloqueo del thread principal** si los cálculos son pesados
- **Comportamiento impredecible** en navegadores más lentos

---

### 2. Inconsistencia en la Visualización vs Cálculo

En el **Resumen de Precio** (líneas 1874-1920), los cálculos para mostrar los conceptos **NO consideran** `multiplicar_por_bultos`:

```tsx
// En el JSX actual (incorrecto):
const calculatedAmount = isPercentage 
  ? valorDeclarado * Number(cp.porcentaje) / 100 
  : Number(cp.monto);
// ¡Falta multiplicar por cantidadBultos si aplica!
```

Mientras que las funciones de cálculo **SÍ lo consideran**:

```tsx
// En calcularTotalConceptosBasicos (correcto):
if (cp.multiplicar_por_bultos) {
  montoConcepto *= cantidadBultos;
}
```

Esto causa una **inconsistencia visual** que puede confundir al usuario.

---

## Plan de Solución

### Paso 1: Memoizar el Cálculo de Precio

Envolver `calcularPrecio()` en un `useMemo` para evitar recálculos innecesarios:

```tsx
const precioCalculado = useMemo(() => {
  if (!selectedTarifa) return 0;
  
  const peso = parseFloat(formData.peso_kg) || 0;
  const precioBase = Number(selectedTarifa.precio_base) || 0;
  const rangos = (selectedTarifa as any).rangos_precios || {};
  const valorDeclarado = parseFloat(formData.valor_declarado) || 0;
  const cantidadBultos = parseInt(formData.cantidad_bultos) || 1;
  
  // ... resto del cálculo
  
}, [
  selectedTarifa, 
  formData.peso_kg, 
  formData.valor_declarado, 
  formData.cantidad_bultos,
  formData.dimensiones,
  conceptosBasicos, 
  conceptosAdicionales,
  conceptosSeleccionados,
  distanciaKm
]);
```

---

### Paso 2: Corregir Visualización en Resumen de Precio

Actualizar el JSX del resumen para incluir la multiplicación por bultos:

```tsx
{conceptosBasicos.map((cp) => {
  const valorDeclarado = parseFloat(formData.valor_declarado) || 0;
  const cantidadBultos = parseInt(formData.cantidad_bultos) || 1;
  const isPercentage = cp.es_porcentaje && cp.porcentaje;
  
  let calculatedAmount = isPercentage 
    ? valorDeclarado * Number(cp.porcentaje) / 100 
    : Number(cp.monto);
  
  // Multiplicar por bultos si aplica
  if (cp.multiplicar_por_bultos) {
    calculatedAmount *= cantidadBultos;
  }
  
  return (
    <div key={cp.id} className="flex justify-between text-sm">
      <span>
        {cp.concepto?.nombre || 'Concepto'}
        {/* Mostrar indicador de multiplicación por bultos */}
        {cp.multiplicar_por_bultos && cantidadBultos > 1 && (
          <span className="text-xs text-muted-foreground ml-1">
            (x{cantidadBultos} bultos)
          </span>
        )}
        {isPercentage && valorDeclarado > 0 && (
          <span className="text-xs text-muted-foreground ml-1">
            ({cp.porcentaje}% de {formatCurrency(valorDeclarado)})
          </span>
        )}
      </span>
      <span>{formatCurrency(calculatedAmount)}</span>
    </div>
  );
})}
```

Hacer lo mismo para los conceptos adicionales.

---

### Paso 3: Eliminar Funciones de Cálculo Duplicadas

Convertir las funciones `calcularTotalConceptosBasicos`, `calcularTotalConceptosAdicionales` y `calcularTotalConceptos` en valores memoizados para evitar recrearlas en cada render:

```tsx
const totalConceptosBasicos = useMemo(() => {
  const valorDeclarado = parseFloat(formData.valor_declarado) || 0;
  const cantidadBultos = parseInt(formData.cantidad_bultos) || 1;
  
  return conceptosBasicos.reduce((sum, cp) => {
    let montoConcepto = 0;
    if (cp.es_porcentaje && cp.porcentaje) {
      montoConcepto = valorDeclarado * Number(cp.porcentaje) / 100;
    } else {
      montoConcepto = Number(cp.monto);
    }
    if (cp.multiplicar_por_bultos) {
      montoConcepto *= cantidadBultos;
    }
    return sum + montoConcepto;
  }, 0);
}, [conceptosBasicos, formData.valor_declarado, formData.cantidad_bultos]);
```

---

## Resumen de Cambios

| Archivo | Cambio |
|---------|--------|
| `src/pages/NewShipment.tsx` | Memoizar `precioCalculado` con `useMemo` |
| `src/pages/NewShipment.tsx` | Convertir funciones de cálculo a `useMemo` |
| `src/pages/NewShipment.tsx` | Corregir visualización de conceptos en resumen (incluir `multiplicar_por_bultos`) |
| `src/pages/NewShipment.tsx` | Mostrar indicador "(x3 bultos)" cuando aplique |

---

## Sección Técnica

### Por qué los cálculos en cada render causan problemas

React recalcula todo el componente cuando cambia cualquier estado. Con funciones como:

```tsx
const calcularPrecio = () => { ... }
const precioCalculado = calcularPrecio(); // Se ejecuta en CADA render
```

Cada tecla presionada (que actualiza `formData`) dispara:
1. Actualización del estado
2. Re-render del componente
3. Ejecución de `calcularPrecio()`
4. Ejecución de `calcularTotalConceptos()`
5. Ejecución de `calcularTotalConceptosBasicos()` 
6. Ejecución de `calcularTotalConceptosAdicionales()`
7. Iteraciones sobre arrays (`reduce`, `filter`)

Con `useMemo`, React solo recalcula cuando cambian las dependencias específicas, no en cada keystroke.

### Impacto Esperado

- **Rendimiento**: Menos cálculos = menos bloqueo del UI
- **Estabilidad**: Elimina posibles estados intermedios problemáticos
- **Consistencia visual**: El resumen mostrará los mismos valores que se guardan

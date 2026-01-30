

# Plan: Unificar Lógica de Cálculo de Tarifas

## Análisis del Estado Actual

He revisado el código y encontré que **ya existen varias piezas del sistema**, pero no están correctamente conectadas:

### Lo que YA existe:
| Componente | Estado | Ubicación |
|------------|--------|-----------|
| Rangos de peso escalonados (`rangos_kg`) | ✅ Se guarda | `tarifas` tabla |
| Cálculo usando `rangos_kg` | ⚠️ Parcial | `NewShipment.tsx` línea 496-506 |
| Concepto "Retiro" | ✅ Funciona | Se excluye cuando no hay retiro |
| Concepto "Entrega" | ✅ Funciona | Se excluye cuando no hay entrega |
| Concepto "Seguro" | ⚠️ Duplicado | Hay 2 sistemas (concepto y configuración global) |
| Valor mínimo de seguro | ✅ Funciona | Usa `configuracion_seguro` |

### Problemas Detectados:

1. **Resumen de Precio** (líneas 1987-2009): Muestra `precio_base` siempre, ignorando cuando se usó un rango escalonado
2. **Seguro duplicado**: Existe `tarifa_concepto_precios` para "seguro" Y `configuracion_seguro` - se usan ambos de forma inconsistente
3. **Falta visualización clara** de la lógica aplicada (por kg vs rangos escalonados)

---

## Lógica Unificada Propuesta

```text
CÁLCULO DE PRECIO TOTAL
═══════════════════════

1. FLETE BASE
   ├── Si tipo_tarifa = 'peso':
   │   ├── Si hay rangos_kg definidos:
   │   │   └── Buscar rango donde peso >= desde AND peso <= hasta
   │   │       └── Usar precio de ese rango
   │   └── Si NO hay rangos_kg (método simple):
   │       └── precio_base + (peso_excedente × adicional_por_kg)
   │
   ├── Si alguna dimensión > umbral_volumen_cm:
   │   └── Cambiar a cobro por m³: precio_base + (volumen_m3 × precio_por_m3)
   │
   └── Si tipo_tarifa = 'distancia':
       └── distancia_km × precio_por_km

2. SEGURO (concepto básico)
   ├── Tomar valor_declarado (o valor_minimo si está vacío)
   └── Aplicar el monto/porcentaje del concepto "seguro" de la tarifa

3. RETIRO (concepto básico, condicional)
   └── Solo si tipo_servicio incluye retiro: puerta_sucursal, puerta_puerta, retiro_almacenaje

4. ENTREGA (concepto básico, condicional)
   └── Solo si tipo_servicio incluye entrega: sucursal_puerta, puerta_puerta

5. CONCEPTOS ADICIONALES (opcionales)
   └── Seleccionados por el usuario (embalaje, servicio agencia, etc.)

TOTAL = FLETE + SEGURO + [RETIRO] + [ENTREGA] + [ADICIONALES]
```

---

## Cambios a Implementar

### 1. Corregir el Resumen de Precio

El resumen actualmente muestra `precio_base` fijo. Debe mostrar el **flete real calculado**:

**Antes (línea 1987-1990):**
```tsx
<span>Flete ({selectedTarifa.nombre})</span>
<span>{formatCurrency(selectedTarifa.precio_base)}</span>
```

**Después:**
```tsx
<span>Flete ({selectedTarifa.nombre})</span>
<span>{formatCurrency(fleteCalculado)}</span>
{fleteDescripcion && (
  <span className="text-xs text-muted-foreground">{fleteDescripcion}</span>
)}
```

Donde `fleteCalculado` es el resultado del cálculo por rangos y `fleteDescripcion` explica el cálculo (ej: "Rango 10.1-15kg").

### 2. Extraer el Cálculo del Flete a una Función

Crear una función/memo que retorne el flete y una descripción:

```typescript
const { fleteCalculado, fleteDescripcion } = useMemo(() => {
  if (!selectedTarifa) return { fleteCalculado: 0, fleteDescripcion: '' };
  
  const peso = parseFloat(formData.peso_kg) || 0;
  const precioBase = Number(selectedTarifa.precio_base) || 0;
  const rangosKg = selectedTarifa.rangos_kg || [];
  
  // PRIORIDAD 1: Rangos escalonados
  if (rangosKg.length > 0 && peso > 0) {
    const rango = rangosKg.find(r => peso >= r.desde && peso <= r.hasta);
    if (rango) {
      return {
        fleteCalculado: rango.precio,
        fleteDescripcion: `Rango ${rango.desde}-${rango.hasta} kg`
      };
    }
    // Peso excede todos los rangos
    const ultimoRango = rangosKg[rangosKg.length - 1];
    return {
      fleteCalculado: ultimoRango.precio,
      fleteDescripcion: `Peso ${peso}kg > máximo ${ultimoRango.hasta}kg (se aplica último rango)`
    };
  }
  
  // PRIORIDAD 2: Método simple
  const rangos = selectedTarifa.rangos_precios || {};
  if (peso > (rangos.peso_base_hasta || 0)) {
    const extra = peso - rangos.peso_base_hasta;
    const flete = precioBase + (extra * (rangos.adicional_por_kg || 0));
    return {
      fleteCalculado: flete,
      fleteDescripcion: `Base + ${extra.toFixed(1)}kg extra`
    };
  }
  
  return { fleteCalculado: precioBase, fleteDescripcion: 'Precio base' };
}, [selectedTarifa, formData.peso_kg]);
```

### 3. Limpiar el Resumen (Eliminar Duplicación)

Actualmente el resumen tiene:
- Línea 1987: "Flete" (muestra precio_base)
- Línea 1993-2009: "+X kg extra" (duplica si hay rangos)

Unificar para que solo muestre **una línea de flete** con la descripción correcta.

### 4. Mantener la Lógica de Conceptos (Ya Funciona)

La lógica actual de conceptos (líneas 340-364) **ya es correcta**:
- Excluye "retiro" si `!tieneRetiro`
- Excluye "entrega" si `!tieneEntrega`
- El seguro usa el valor mínimo cuando no hay valor declarado

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/NewShipment.tsx` | Extraer cálculo de flete a memo separado, actualizar resumen |

---

## Resumen de la Lógica Final

La lógica que propongo deja establecido:

| Modalidad | Flete | + Seguro | + Retiro | + Entrega |
|-----------|-------|----------|----------|-----------|
| Sucursal → Sucursal | ✅ Por rangos/peso | ✅ Siempre | ❌ No | ❌ No |
| Sucursal → Puerta | ✅ Por rangos/peso | ✅ Siempre | ❌ No | ✅ Sí |
| Puerta → Sucursal | ✅ Por rangos/peso | ✅ Siempre | ✅ Sí | ❌ No |
| Puerta → Puerta | ✅ Por rangos/peso | ✅ Siempre | ✅ Sí | ✅ Sí |

El cálculo del flete por peso:
1. **Si hay `rangos_kg`**: usar precio escalonado
2. **Si no hay `rangos_kg`**: usar método simple (base + adicional por kg)
3. **Si dimensiones > umbral**: cambiar a cobro por m³


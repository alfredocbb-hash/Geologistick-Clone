

# Plan: Corregir Diálogo de Creación de Envío desde Pedido

## Problemas Identificados

### 1. Bug crítico: useState mal usado (línea 88-92)
```typescript
useState(() => {
  if (seller?.sucursal_pickup_id) {
    setSucursalOrigenId(seller.sucursal_pickup_id);
  }
});
```
Esto **nunca funciona** porque:
- `useState` no es para efectos secundarios (debería ser `useEffect`)
- `seller` es `undefined` en el primer render

### 2. El precio no se calcula automáticamente
El seller tiene una tarifa asignada (`tarifa_id`) pero el precio empieza en `$0` y requiere ingreso manual.

---

## Solución

### Archivo a modificar
`src/components/ecommerce/CreateShipmentFromOrderDialog.tsx`

---

## Cambios Técnicos

### 1. Importar useEffect
```typescript
import { useState, useEffect } from 'react';
```

### 2. Corregir inicialización de sucursal

**Reemplazar líneas 87-92:**
```typescript
// Set default origin branch from seller
useEffect(() => {
  if (seller?.sucursal_pickup_id && !sucursalOrigenId) {
    setSucursalOrigenId(seller.sucursal_pickup_id);
  }
}, [seller?.sucursal_pickup_id]);
```

### 3. Agregar query para obtener tarifa y conceptos

Después del query de sucursales (línea 85), agregar:

```typescript
// Fetch tarifa and calculate price
const { data: tarifaData } = useQuery({
  queryKey: ['tarifa-precios', seller?.tarifa_id],
  queryFn: async () => {
    if (!seller?.tarifa_id) return null;
    
    const { data: tarifa, error: tarifaError } = await supabase
      .from('tarifas')
      .select('id, nombre, precio_base')
      .eq('id', seller.tarifa_id)
      .single();
    
    if (tarifaError) throw tarifaError;
    
    const { data: conceptos, error: conceptosError } = await supabase
      .from('tarifa_concepto_precios')
      .select(`
        monto,
        concepto:tarifa_conceptos(codigo, nombre, es_basico)
      `)
      .eq('tarifa_id', seller.tarifa_id);
    
    if (conceptosError) throw conceptosError;
    
    return { tarifa, conceptos };
  },
  enabled: !!seller?.tarifa_id && open,
});
```

### 4. Auto-calcular precio cuando se carga la tarifa

Agregar después de la query:
```typescript
// Auto-calculate price from tarifa
useEffect(() => {
  if (tarifaData?.tarifa && precio === 0) {
    let precioCalculado = Number(tarifaData.tarifa.precio_base) || 0;
    
    // Add basic concepts (like "entrega")
    const conceptosBasicos = tarifaData.conceptos?.filter(
      cp => cp.concepto?.es_basico
    ) || [];
    
    conceptosBasicos.forEach(cp => {
      precioCalculado += Number(cp.monto) || 0;
    });
    
    setPrecio(precioCalculado);
  }
}, [tarifaData]);
```

### 5. Mostrar desglose en la UI (opcional pero recomendado)

Agregar después del grid de Bultos/Precio (después de línea 270):
```typescript
{tarifaData?.tarifa && (
  <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-sm">
    <p className="font-medium text-blue-700 dark:text-blue-300 mb-2">
      Tarifa: {tarifaData.tarifa.nombre}
    </p>
    <div className="text-blue-600 dark:text-blue-400 space-y-1">
      <div className="flex justify-between">
        <span>Flete base:</span>
        <span>${Number(tarifaData.tarifa.precio_base || 0).toLocaleString()}</span>
      </div>
      {tarifaData.conceptos?.filter(c => c.concepto?.es_basico).map((cp, idx) => (
        <div key={idx} className="flex justify-between">
          <span>{cp.concepto?.nombre}:</span>
          <span>${Number(cp.monto || 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  </div>
)}
```

---

## Resultado Esperado

1. Al abrir el diálogo, la **sucursal de origen** se selecciona automáticamente si el seller tiene una configurada
2. El **precio se calcula automáticamente** basándose en la tarifa del seller
3. Se muestra un **desglose visual** de cómo se compone el precio
4. El usuario puede **modificar el precio** manualmente si es necesario
5. El botón "Crear Envío" funciona correctamente


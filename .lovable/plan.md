

# Plan: Corregir Error de Duplicado al Guardar Comisiones de Sucursal

## Problema Identificado

El administrador de BlackBox recibe el error:
```
Error: duplicate key value violates unique constraint "sucursal_comisiones_unique_rol"
```

### Causa Raíz

El código actual en `src/pages/Branches.tsx` usa un patrón de "verificar-luego-insertar" que falla bajo concurrencia:

```typescript
// Código problemático (líneas 318-341)
const existing = sucursalComisiones.find(
  (c) => c.concepto_id === conceptoId && c.tipo_rol === tipoRol
);

if (existing) {
  // UPDATE
} else {
  // INSERT
}
```

Cuando una sucursal **no tiene comisiones previas** (como QUILMES que tiene 0 registros):

1. `sucursalComisiones` está vacío al abrir el diálogo
2. Para cada concepto (5 conceptos × 2 roles = 10 operaciones), todas pasan la condición `!existing`
3. `Promise.all()` ejecuta los 10 INSERTs **en paralelo**
4. Si el usuario hace doble clic o hay cualquier race condition, el mismo registro se intenta insertar múltiples veces

---

## Solución: Usar UPSERT Nativo

Reemplazar el patrón manual por `upsert()` de Supabase con `onConflict`:

```typescript
const { error } = await supabase
  .from('sucursal_comisiones')
  .upsert(data, { 
    onConflict: 'sucursal_id,concepto_id,tipo_rol',
    ignoreDuplicates: false 
  });
```

Esto es atómico a nivel de base de datos y maneja correctamente la concurrencia.

---

## Cambios Requeridos

### Archivo: `src/pages/Branches.tsx`

**Función `saveCommission` (líneas 311-342)**

Reemplazar:
```typescript
const saveCommission = async (
  conceptoId: string,
  values: CommissionValues,
  tipoRol: 'emision' | 'recepcion'
) => {
  if (!selectedSucursalForCommissions) return;
  
  const existing = sucursalComisiones.find(
    (c) => c.concepto_id === conceptoId && c.tipo_rol === tipoRol
  );
  
  const data = {
    sucursal_id: selectedSucursalForCommissions.id,
    concepto_id: conceptoId,
    porcentaje_contado: parseFloat(values.contado) || 0,
    porcentaje_destino: parseFloat(values.destino) || 0,
    porcentaje_cta_cte: parseFloat(values.cta_cte) || 0,
    base_comision: values.base || 'total',
    tipo_rol: tipoRol,
  };

  if (existing) {
    const { error } = await supabase
      .from('sucursal_comisiones')
      .update(data)
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('sucursal_comisiones').insert(data);
    if (error) throw error;
  }
};
```

Por:
```typescript
const saveCommission = async (
  conceptoId: string,
  values: CommissionValues,
  tipoRol: 'emision' | 'recepcion'
) => {
  if (!selectedSucursalForCommissions) return;
  
  const data = {
    sucursal_id: selectedSucursalForCommissions.id,
    concepto_id: conceptoId,
    porcentaje_contado: parseFloat(values.contado) || 0,
    porcentaje_destino: parseFloat(values.destino) || 0,
    porcentaje_cta_cte: parseFloat(values.cta_cte) || 0,
    base_comision: values.base || 'total',
    tipo_rol: tipoRol,
  };

  // Usar upsert nativo para manejar concurrencia correctamente
  const { error } = await supabase
    .from('sucursal_comisiones')
    .upsert(data, { 
      onConflict: 'sucursal_id,concepto_id,tipo_rol',
      ignoreDuplicates: false 
    });
  
  if (error) throw error;
};
```

---

## Beneficios

| Aspecto | Antes | Después |
|---------|-------|---------|
| Concurrencia | Race condition posible | Atómico en BD |
| Código | 20 líneas | 15 líneas |
| Doble clic | Error de duplicado | Se sobrescribe sin error |
| Rendimiento | Similar | Similar |

---

## Verificación

1. El administrador de BlackBox podrá guardar comisiones en QUILMES sin error
2. Las sucursales con comisiones existentes seguirán funcionando (UPSERT actualiza si existe)
3. No se requieren cambios en la base de datos


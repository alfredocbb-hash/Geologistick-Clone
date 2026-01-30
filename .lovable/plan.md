

# Plan: Mejorar Eliminación de Tarifas con Validación de Dependencias

## Problema Identificado

El error indica que la tarifa **"CABA - GBA"** está siendo usada por sellers de e-commerce:

```
violates foreign key constraint "ecommerce_sellers_tarifa_id_fkey" on table "ecommerce_sellers"
```

Esto ocurre porque hay sellers que tienen `tarifa_id` apuntando a esa tarifa.

## Solución Propuesta

Agregar una **verificación previa** antes de eliminar para:
1. Detectar si hay sellers, envíos u otras tablas usando esa tarifa
2. Mostrar un mensaje claro indicando **qué está usando** la tarifa
3. Ofrecer la opción de **desvincular automáticamente** antes de eliminar

---

## Cambios a Implementar

### Archivo: `src/pages/Rates.tsx`

**Modificar la mutación de eliminación** para:

1. **Primero verificar dependencias**:
   - Consultar `ecommerce_sellers` con esa `tarifa_id`
   - Consultar `sucursal_tarifas` con esa `tarifa_id`
   - Consultar `envios` con esa `tarifa_id` (si aplica)

2. **Si hay dependencias, mostrar diálogo de confirmación** con opciones:
   - Listar los sellers/sucursales que usan la tarifa
   - Opción de desvincular y eliminar
   - Opción de cancelar

3. **Si confirma desvincular**:
   - Actualizar `ecommerce_sellers SET tarifa_id = NULL WHERE tarifa_id = X`
   - Eliminar de `sucursal_tarifas WHERE tarifa_id = X`
   - Luego eliminar la tarifa

### Código Propuesto

```typescript
const deleteTarifaMutation = useMutation({
  mutationFn: async ({ id, force }: { id: string; force?: boolean }) => {
    // 1. Verificar dependencias
    const { data: sellersUsando } = await supabase
      .from('ecommerce_sellers')
      .select('id, nombre')
      .eq('tarifa_id', id);
    
    const { data: sucursalesUsando } = await supabase
      .from('sucursal_tarifas')
      .select('id, sucursal_id')
      .eq('tarifa_id', id);
    
    const dependencias = {
      sellers: sellersUsando?.length || 0,
      sucursales: sucursalesUsando?.length || 0,
    };
    
    if ((dependencias.sellers > 0 || dependencias.sucursales > 0) && !force) {
      throw new Error(
        `Esta tarifa está en uso por ${dependencias.sellers} seller(s) ` +
        `y ${dependencias.sucursales} sucursal(es). ` +
        `¿Desea desvincularla de todos y eliminarla?`
      );
    }
    
    // 2. Si force=true, desvincular primero
    if (force) {
      await supabase
        .from('ecommerce_sellers')
        .update({ tarifa_id: null })
        .eq('tarifa_id', id);
      
      await supabase
        .from('sucursal_tarifas')
        .delete()
        .eq('tarifa_id', id);
    }
    
    // 3. Eliminar tarifa
    const { error } = await supabase.from('tarifas').delete().eq('id', id);
    if (error) throw error;
  },
  // ...handlers
});
```

### Flujo de UI

1. Usuario hace clic en eliminar
2. Se muestra confirmación inicial
3. Si hay dependencias, se muestra mensaje detallado con opción de forzar
4. Si acepta forzar, se desvincula y elimina

---

## Resultado Esperado

| Situación | Comportamiento |
|-----------|----------------|
| Tarifa sin uso | Se elimina directamente |
| Tarifa usada por sellers | Muestra "Esta tarifa está en uso por X seller(s)..." |
| Usuario confirma forzar | Desvincula sellers y sucursales, luego elimina |




# Plan: Corregir Eliminación de Envío Flex con Reversión de Cuenta Corriente

## Problema Identificado

El error `"violates foreign key constraint 'seller_cuenta_corriente_envio_id_fkey'"` ocurre porque:

1. Al crear un envío desde una orden e-commerce, el sistema registra un **cargo** en `seller_cuenta_corriente` referenciando el `envio_id`
2. Al intentar eliminar el envío, ese registro de cuenta corriente bloquea la eliminación por la FK

### Tablas con FK a envíos que deben limpiarse:
| Tabla | FK Column | Acción |
|-------|-----------|--------|
| `seller_cuenta_corriente` | envio_id | Crear ajuste de reversión + limpiar FK |
| `envio_historial` | envio_id | Eliminar (ya está en el código) |
| `envio_detalles` | envio_id | Eliminar (ya está en el código) |
| `ecommerce_orders` | envio_id | Limpiar FK (ya está en el código) |

---

## Solución

Modificar `deleteShipmentMutation` en `Orders.tsx` para:

1. **Buscar movimiento de cargo** en `seller_cuenta_corriente` asociado al envío
2. **Crear movimiento de ajuste negativo** para revertir el saldo
3. **Limpiar el `envio_id`** en el movimiento original (para romper la FK)
4. Continuar con la eliminación normal del envío

---

## Flujo Actualizado de Eliminación

```text
1. Buscar cargo en seller_cuenta_corriente con envio_id = X
      ↓
2. Si existe cargo:
   - Obtener saldo actual del seller
   - Insertar movimiento tipo "ajuste" con monto negativo
   - Actualizar registro original: envio_id = null
      ↓
3. Eliminar envio_historial
      ↓
4. Eliminar envio_detalles
      ↓
5. Desvincular ecommerce_orders (envio_id = null)
      ↓
6. Eliminar envío de tabla "envios"
```

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/ecommerce/Orders.tsx` | Actualizar `deleteShipmentMutation` para manejar la reversión de cuenta corriente |

---

## Sección Técnica

### Código actualizado para `deleteShipmentMutation`:

```typescript
const deleteShipmentMutation = useMutation({
  mutationFn: async (order: Order) => {
    if (!order.envio_id) throw new Error('No hay envío asociado');
    
    // PASO 0: Buscar movimientos de cargo en cuenta corriente del seller
    const { data: cargos } = await supabase
      .from('seller_cuenta_corriente')
      .select('id, monto, seller_id, descripcion')
      .eq('envio_id', order.envio_id)
      .eq('tipo', 'cargo');
    
    // Si hay cargos, crear reversión y limpiar FK
    if (cargos && cargos.length > 0) {
      for (const cargo of cargos) {
        // Obtener saldo actual del seller
        const { data: seller } = await supabase
          .from('ecommerce_sellers')
          .select('saldo_cuenta_corriente')
          .eq('id', cargo.seller_id)
          .single();
        
        const saldoAnterior = seller?.saldo_cuenta_corriente || 0;
        const montoReversion = -Math.abs(cargo.monto);
        const saldoNuevo = saldoAnterior + montoReversion;
        
        // Crear ajuste de reversión
        await supabase
          .from('seller_cuenta_corriente')
          .insert({
            seller_id: cargo.seller_id,
            tipo: 'ajuste',
            monto: montoReversion,
            saldo_anterior: saldoAnterior,
            saldo_nuevo: saldoNuevo,
            descripcion: `Reversión: ${cargo.descripcion || 'Envío eliminado'}`,
            order_id: order.id,
          });
        
        // Limpiar envio_id del cargo original (romper FK)
        await supabase
          .from('seller_cuenta_corriente')
          .update({ envio_id: null })
          .eq('id', cargo.id);
      }
    }
    
    // PASO 1: Eliminar historial del envío
    await supabase
      .from('envio_historial')
      .delete()
      .eq('envio_id', order.envio_id);
    
    // PASO 2: Eliminar detalles del envío
    await supabase
      .from('envio_detalles')
      .delete()
      .eq('envio_id', order.envio_id);
    
    // PASO 3: Desvincular la orden del envío
    await supabase
      .from('ecommerce_orders')
      .update({ envio_id: null })
      .eq('id', order.id);
    
    // PASO 4: Eliminar el envío
    const { error } = await supabase
      .from('envios')
      .delete()
      .eq('id', order.envio_id);
    
    if (error) throw error;
  },
  onSuccess: () => {
    toast({ title: 'Envío eliminado correctamente' });
    queryClient.invalidateQueries({ queryKey: ['ecommerce-orders'] });
    setDeleteOrder(null);
  },
  onError: (error: Error) => {
    toast({ 
      title: 'Error al eliminar', 
      description: error.message,
      variant: 'destructive' 
    });
  },
});
```

### Tipo de Movimiento para Reversión

Se usa `tipo: 'ajuste'` con monto negativo para:
- Mantener trazabilidad del movimiento original
- Reflejar correctamente en el historial de cuenta corriente
- El trigger existente `trigger_update_seller_balance` actualizará automáticamente el saldo del seller

---

## Resultado Esperado

| Antes | Después |
|-------|---------|
| Error FK al eliminar | Eliminación exitosa |
| Cargo permanece en cuenta corriente | Cargo revertido con ajuste negativo |
| Saldo incorrecto si se re-sincroniza | Saldo correcto, listo para nueva sincronización |


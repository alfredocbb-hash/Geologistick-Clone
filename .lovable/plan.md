

# Plan: Agregar Opción de Eliminar Envío Flex en Pedidos e-Commerce

## Problema Identificado

En la página de **Pedidos e-Commerce** (`/ecommerce/orders`), el menú de acciones solo tiene:
- Ver Detalles
- Editar Pedido
- Crear Envío

**Falta la opción de eliminar** el envío asociado a una orden de Mercado Libre Flex, lo cual es necesario para:
1. Re-sincronizar el envío y capturar el precio de flete correcto
2. Corregir errores de datos en envíos creados incorrectamente

---

## Solución Propuesta

Agregar una opción **"Eliminar Envío"** en el menú desplegable de acciones cuando:
- La orden tiene un envío asociado (`envio_id` no es null)
- El envío no está entregado ni en reparto

### Flujo de Eliminación

1. Usuario hace clic en "Eliminar Envío"
2. Se muestra diálogo de confirmación
3. Al confirmar:
   - Se elimina el historial del envío (`envio_historial`)
   - Se elimina los detalles del envío (`envio_detalles`)
   - Se desvincula la orden (`envio_id = null` en `ecommerce_orders`)
   - Se elimina el envío de la tabla `envios`
4. La orden queda disponible para crear un nuevo envío (o re-sincronizar)

---

## Cambios Necesarios

### Archivo: `src/pages/ecommerce/Orders.tsx`

| Cambio | Descripción |
|--------|-------------|
| Estado nuevo | Agregar `deleteOrder` para controlar el diálogo |
| Mutation | Crear `deleteShipmentMutation` para eliminar el envío |
| Menú | Agregar opción "Eliminar Envío" en el DropdownMenu |
| Diálogo | Agregar AlertDialog de confirmación |

---

## Sección Técnica

### 1. Nuevo estado para el diálogo
```typescript
const [deleteOrder, setDeleteOrder] = useState<Order | null>(null);
```

### 2. Mutation para eliminar envío
```typescript
const deleteShipmentMutation = useMutation({
  mutationFn: async (order: Order) => {
    if (!order.envio_id) throw new Error('No hay envío asociado');
    
    // 1. Eliminar historial del envío
    await supabase
      .from('envio_historial')
      .delete()
      .eq('envio_id', order.envio_id);
    
    // 2. Eliminar detalles del envío
    await supabase
      .from('envio_detalles')
      .delete()
      .eq('envio_id', order.envio_id);
    
    // 3. Desvincular la orden del envío
    await supabase
      .from('ecommerce_orders')
      .update({ envio_id: null })
      .eq('id', order.id);
    
    // 4. Eliminar el envío
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

### 3. Nueva opción en el menú (línea ~370)
```typescript
{order.envio_id && order.order_status !== 'delivered' && (
  <DropdownMenuItem 
    className="text-destructive"
    onClick={() => setDeleteOrder(order)}
  >
    <Trash2 className="mr-2 h-4 w-4" />
    Eliminar Envío
  </DropdownMenuItem>
)}
```

### 4. Diálogo de confirmación
```typescript
<AlertDialog open={!!deleteOrder} onOpenChange={() => setDeleteOrder(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>¿Eliminar este envío?</AlertDialogTitle>
      <AlertDialogDescription>
        Se eliminará el envío asociado al pedido #{deleteOrder?.external_order_number}.
        La orden quedará disponible para crear un nuevo envío o re-sincronizar.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        onClick={() => deleteOrder && deleteShipmentMutation.mutate(deleteOrder)}
        disabled={deleteShipmentMutation.isPending}
      >
        {deleteShipmentMutation.isPending ? 'Eliminando...' : 'Eliminar Envío'}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## Importaciones Adicionales

```typescript
import { Trash2 } from 'lucide-react';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
```

---

## Resumen de Archivos

| Archivo | Cambios |
|---------|---------|
| `src/pages/ecommerce/Orders.tsx` | Agregar estado, mutation, opción de menú y diálogo de confirmación |


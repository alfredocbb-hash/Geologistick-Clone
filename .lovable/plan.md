

# Plan: Habilitar Creación de Envíos desde Pedidos

## Problemas Identificados

### 1. Botón "Crear X Envíos" del header - Solo para masivos
El botón naranja en el header (que aparece cuando se seleccionan checkboxes) está configurado para mostrar "Funcionalidad próximamente":

```typescript
// Línea 151-157 de Orders.tsx
{selectedOrders.length > 0 && (
  <Button onClick={() => {
    toast({ title: 'Funcionalidad próximamente', description: 'Crear envíos masivos' });
  }}>
    <Truck className="mr-2 h-4 w-4" />
    Crear {selectedOrders.length} Envíos
  </Button>
)}
```

### 2. Opción "Crear Envío" solo para pedidos "paid"
La opción individual en el menú de tres puntos solo aparece para pedidos con estado `paid`:

```typescript
// Línea 293 de Orders.tsx
{!order.envio_id && order.order_status === 'paid' && (
```

El pedido muestra estado **"Pendiente"** aunque el usuario indica que ya está pagado en Tiendanube.

## Solución Propuesta

### Archivo a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/ecommerce/Orders.tsx` | Implementar creación de envíos (individual y masiva) |

---

## Cambios Técnicos

### 1. Permitir crear envío desde cualquier estado (excepto cancelado)

Cambiar la condición de la línea 293:

**Antes:**
```typescript
{!order.envio_id && order.order_status === 'paid' && (
```

**Después:**
```typescript
{!order.envio_id && order.order_status !== 'cancelled' && (
```

Esto permite crear envíos para pedidos pendientes, pagados, etc.

### 2. Implementar creación masiva de envíos (botón header)

Reemplazar el toast "próximamente" con lógica funcional:

```typescript
{selectedOrders.length > 0 && (
  <Button onClick={() => {
    // Get selected orders that don't have envio_id
    const ordersToShip = filteredOrders?.filter(
      o => selectedOrders.includes(o.id) && !o.envio_id && o.order_status !== 'cancelled'
    ) || [];
    
    if (ordersToShip.length === 0) {
      toast({ 
        title: 'Sin pedidos válidos', 
        description: 'Los pedidos seleccionados ya tienen envío o están cancelados',
        variant: 'destructive'
      });
      return;
    }
    
    if (ordersToShip.length === 1) {
      // For single order, open individual dialog
      setCreateShipmentOrder(ordersToShip[0]);
    } else {
      // For multiple orders, show coming soon (or implement bulk)
      toast({ 
        title: 'Funcionalidad próximamente', 
        description: `Crear ${ordersToShip.length} envíos masivos` 
      });
    }
  }}>
    <Truck className="mr-2 h-4 w-4" />
    Crear {selectedOrders.length} Envíos
  </Button>
)}
```

### 3. Agregar botón de acción rápida en la fila (opcional)

Para mejorar la UX, agregar un botón visible directamente en la celda "Envío" cuando el envío está pendiente:

```typescript
<TableCell>
  {order.envio_id ? (
    <Badge variant="default">Creado</Badge>
  ) : order.order_status !== 'cancelled' ? (
    <Button 
      variant="outline" 
      size="sm"
      onClick={() => setCreateShipmentOrder(order)}
    >
      <Truck className="mr-1 h-3 w-3" />
      Crear
    </Button>
  ) : (
    <Badge variant="secondary">-</Badge>
  )}
</TableCell>
```

---

## Resumen de Cambios

```text
┌───────────────────────────────────────────────────────────────┐
│ Pedidos e-Commerce                    [Crear 1 Envíos] ← Ahora│
│                                        funciona para 1 pedido │
├───────────────────────────────────────────────────────────────┤
│ ☑ #100 | Brysha Siempre | ... | Pendiente | [Crear] ← Botón  │
│                                              visible en tabla │
└───────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

1. El botón header "Crear X Envíos" abrirá el diálogo si hay 1 pedido seleccionado
2. La opción "Crear Envío" aparecerá para pedidos pendientes y pagados
3. Se puede crear envíos directamente desde la columna "Envío" sin ir al menú
4. Para creación masiva (2+ pedidos) mostrará "próximamente" hasta implementarla


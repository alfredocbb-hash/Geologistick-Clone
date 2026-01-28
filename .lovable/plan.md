

# Plan: Editar Dirección de Pedidos y Prevenir Envíos Sin Dirección

## Problema Identificado

Algunos pedidos llegan de Tiendanube sin dirección de entrega (cuando el cliente elige "Retiro en local" o hay errores de sincronización). Actualmente:
- No hay forma de editar el pedido para agregar la dirección
- Se puede intentar crear un envío sin dirección, lo que causa problemas en planificación

## Solución Propuesta

### Parte 1: Validar Antes de Crear Envío

Agregar validación en `CreateShipmentFromOrderDialog.tsx` para detectar cuando no hay dirección válida y mostrar advertencia con opción de editar.

### Parte 2: Crear Diálogo de Edición de Pedido

Crear `EditOrderAddressDialog.tsx` que permita:
- Editar dirección con Google Maps Autocomplete
- Actualizar ciudad, provincia, código postal
- Guardar coordenadas para geolocalización

### Flujo de Usuario

```text
┌──────────────────────────────────────────────────────────┐
│                    Flujo de Validación                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Usuario intenta crear envío                             │
│          │                                               │
│          ▼                                               │
│  ┌────────────────────────┐                              │
│  │ ¿Tiene shipping_address│                              │
│  │    válido?             │                              │
│  └────────────────────────┘                              │
│          │                                               │
│    ┌─────┴─────┐                                         │
│    ▼           ▼                                         │
│  [SÍ]        [NO]                                        │
│    │           │                                         │
│    ▼           ▼                                         │
│ Mostrar    Mostrar warning                               │
│ formulario  "Sin dirección"                              │
│ creación     │                                           │
│              ▼                                           │
│         [Editar Pedido]                                  │
│              │                                           │
│              ▼                                           │
│         Diálogo con                                      │
│         AddressAutocomplete                              │
│              │                                           │
│              ▼                                           │
│         Guardar y recargar                               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Archivos a Crear/Modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/components/ecommerce/EditOrderAddressDialog.tsx` | Crear | Diálogo para editar dirección del pedido |
| `src/components/ecommerce/CreateShipmentFromOrderDialog.tsx` | Modificar | Agregar validación de dirección vacía |
| `src/pages/ecommerce/Orders.tsx` | Modificar | Agregar opción "Editar" en menú dropdown |

## Detalles Técnicos

### 1. Nuevo Componente: `EditOrderAddressDialog.tsx`

```tsx
// Estructura principal
- Props: order, open, onOpenChange, onSuccess
- Usar AddressAutocomplete para autocompletado
- Campos editables:
  - shipping_address (con autocomplete)
  - shipping_city
  - shipping_province  
  - shipping_postal_code
  - buyer_phone (por si falta)
- Al seleccionar dirección: guardar lat/lng automáticamente
- Mutation para actualizar ecommerce_orders
```

### 2. Validación en `CreateShipmentFromOrderDialog.tsx`

```tsx
// Agregar después de la verificación de envio_id existente
const hasValidAddress = order.shipping_address?.trim().length > 0;

// Si no tiene dirección, mostrar:
<div className="text-center py-6 space-y-4">
  <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto" />
  <h3>Este pedido no tiene dirección de entrega</h3>
  <p>Debes agregar una dirección antes de crear el envío.</p>
  <Button onClick={() => setShowEditAddress(true)}>
    <Edit className="mr-2 h-4 w-4" />
    Agregar Dirección
  </Button>
</div>
```

### 3. Agregar Opción "Editar" en `Orders.tsx`

```tsx
<DropdownMenuItem onClick={() => setEditOrder(order)}>
  <Edit className="mr-2 h-4 w-4" />
  Editar Pedido
</DropdownMenuItem>
```

## Beneficios

- **Prevención**: No se pueden crear envíos sin dirección
- **Corrección**: El usuario puede arreglar pedidos incompletos
- **UX**: Flujo guiado desde error hasta solución
- **Geolocalización**: Al usar autocomplete, se guardan coordenadas

## Estimación

| Tarea | Tiempo |
|-------|--------|
| Crear EditOrderAddressDialog | 20 min |
| Agregar validación en CreateShipmentFromOrderDialog | 10 min |
| Integrar en Orders.tsx | 5 min |
| **Total** | ~35 min |


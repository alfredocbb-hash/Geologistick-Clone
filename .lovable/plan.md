
# Vinculacion de Sellers con Clientes

## Problema
Algunos sellers (especialmente los sincronizados via MercadoLibre o creados antes de la logica de auto-link) no tienen `cliente_id`, lo que impide que sus envios comunes se incluyan en las liquidaciones.

## Solucion

### 1. Mostrar estado de vinculacion en la tabla de Sellers

En `src/pages/ecommerce/Sellers.tsx`:
- Agregar `cliente_id` al interface `Seller`
- Agregar una nueva columna "Cliente" en la tabla que muestre:
  - Si tiene `cliente_id`: icono verde con "Vinculado" 
  - Si NO tiene `cliente_id`: icono naranja con "Sin vincular"

### 2. Agregar accion "Vincular Cliente" en el menu de cada seller

En el dropdown de acciones de cada seller sin `cliente_id`:
- Nuevo item "Vincular Cliente" que busca automaticamente un cliente existente por email/telefono
- Si encuentra uno, lo vincula directamente
- Si no encuentra, crea un nuevo cliente con los datos del seller y lo vincula
- Muestra toast con el resultado

### 3. Boton "Vincular Todos" para vincular en lote

Agregar un boton en el header (junto a "Sincronizar Todas") que:
- Filtra sellers sin `cliente_id`
- Para cada uno, ejecuta la misma logica: buscar cliente por email/telefono, o crear uno nuevo
- Muestra progreso y resultado final

### 4. Mostrar estado en SellerDetailsDialog

En `src/components/ecommerce/SellerDetailsDialog.tsx`:
- Agregar badge indicando si esta vinculado a un cliente
- Mostrar nombre del cliente vinculado si existe

## Cambios por archivo

| Archivo | Cambio |
|---------|--------|
| `src/pages/ecommerce/Sellers.tsx` | Agregar `cliente_id` al tipo, columna "Cliente" en tabla, accion individual "Vincular Cliente", boton bulk "Vincular Todos" |
| `src/components/ecommerce/SellerDetailsDialog.tsx` | Mostrar estado de vinculacion con cliente |

## Logica de vinculacion (reutilizada de CreateSellerDialog)

```text
1. Buscar en tabla 'clientes' por email o telefono del seller (mismo tenant)
2. Si encuentra -> usar ese cliente_id
3. Si no encuentra -> crear nuevo cliente con datos del seller
4. Actualizar ecommerce_sellers.cliente_id con el resultado
```

No se requieren cambios en la base de datos ya que `cliente_id` ya existe en `ecommerce_sellers`.

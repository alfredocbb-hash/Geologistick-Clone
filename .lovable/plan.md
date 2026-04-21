
## Objetivo
Agregar un filtro **"Chofer"** en `src/pages/ecommerce/Orders.tsx` para acotar pedidos por el chofer asignado al envío.

## Cambios

**Archivo único:** `src/pages/ecommerce/Orders.tsx`

1. **Nuevo estado**: `const [choferFilter, setChoferFilter] = useState<string>('all');`

2. **Nueva query** `ecommerce-choferes-filter` (en paralelo a `ecommerce-sellers-filter`): trae los choferes activos del tenant — `user_roles` con `role='chofer'` + `profiles` (nombre/apellido) — para poblar el dropdown. Mismo patrón que ya se usa en `Drivers.tsx` y `Routes.tsx`.

3. **Aplicar filtro en `filteredOrders`** (cliente):
   ```ts
   const matchesChofer =
     choferFilter === 'all'
       ? true
       : choferFilter === 'sin_asignar'
       ? !o.envio?.chofer_id
       : o.envio?.chofer_id === choferFilter;
   return matchesSearch && matchesStatus && matchesFulfillment && matchesChofer;
   ```

4. **Nuevo `Select` en la barra de filtros** (al lado de "Seller"):
   - "Todos los choferes" (default)
   - "Sin asignar" (envíos sin chofer)
   - Lista de choferes (`{nombre} {apellido}`)

5. Sin cambios en server query: el filtro se aplica en cliente sobre `orders` ya cargados (mismo patrón que `statusFilter` y `fulfillmentFilter`).

## Detalles técnicos
- El campo `envio.chofer_id` ya está en el SELECT actual (línea 227), no requiere modificar el query principal.
- Los pedidos sin envío creado quedan agrupados bajo "Sin asignar" junto con los envíos sin chofer.
- La lista de choferes se cachea por `tenantId` igual que sellers.

## Riesgo
Bajo. Cambio aislado de UI + filtro en cliente. No toca mutaciones ni el query principal.

## Verificación
1. Abrir Pedidos e-Commerce → confirmar que aparece el dropdown "Chofer" entre "Seller" y "Estado pedido".
2. Elegir un chofer específico → solo se ven pedidos cuyo envío esté asignado a ese chofer.
3. Elegir "Sin asignar" → se ven pedidos sin envío o sin chofer asignado.
4. Combinar con "Seller" y "Estado pedido" para asegurar que los filtros se acumulan correctamente.

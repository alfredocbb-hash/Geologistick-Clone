## Problema

En `src/pages/Shipments.tsx` la consulta principal de envíos no filtra por el estado del seller remitente, así que los envíos de sellers inactivos siguen apareciendo (lista y stats).

## Cambios

1. **Nueva subconsulta de sellers inactivos** (`src/pages/Shipments.tsx`):
   - Traer de `ecommerce_sellers` los registros con `activo = false` del tenant actual, quedándome con sus `cliente_id` (los envíos vinculan al seller a través de `remitente_id → clientes.id`, según la regla ya establecida del proyecto).
   - Cachear con `useQuery` bajo `['inactive-seller-cliente-ids', tenant_id]`.

2. **Excluir esos remitentes de la query de envíos**:
   - En la query `['envios', ...]` agregar `.not('remitente_id', 'in', '(id1,id2,...)')` cuando haya IDs.
   - Sumar el array de IDs al `queryKey` para que refresque si cambia.
   - Aplicar la misma exclusión en la query `['envios-stats', ...]` en cada `base()`.

3. **Sin cambios de UI ni de otras pantallas** — solo Gestión de Envíos.

## Notas técnicas

- El vínculo seller → envío es `ecommerce_sellers.cliente_id = envios.remitente_id`. Sellers sin `cliente_id` no generan envíos, así que se ignoran.
- Búsqueda global por tracking (`isGlobalSearch`) también aplicará la exclusión — un envío histórico de un seller inactivo no debe seguir apareciendo en gestión.
- Superadmin no se exceptúa (no fue pedido); si querés bypass para superadmin, avisame y lo agrego.
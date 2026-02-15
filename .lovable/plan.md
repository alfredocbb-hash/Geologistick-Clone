

# Fix: Precios en $0 y atribucion incorrecta de envios en liquidaciones de sellers

## Problemas encontrados

### Problema 1: Envios en $0

**Causa raiz**: En la funcion de calculo de liquidaciones (linea 504-515), las tarifas de zona solo se cargan si alguno de los sellers seleccionados tiene una `tarifa_id` asignada cuyo `tipo_tarifa` sea `'zona'`. Pero los sellers afectados (Gonzalez, Gauna, etc.) no tienen `tarifa_id` asignada (es `null`). Por lo tanto:

- `tarifasMap` queda vacio
- `hasZoneTarifa` es `false`
- Las tarifas de zona del tenant nunca se cargan
- El precio queda en el `precio_total` original del envio (que puede ser $0 o incorrecto)

La pestaña "Saldos por Seller" (linea 184-191) **siempre** carga las tarifas de zona del tenant, por eso ahi los montos se ven bien. Pero el calculo de liquidaciones no replica esa misma logica.

### Problema 2: Envio de otro seller

**Causa raiz**: Los 6 sellers (Gonzalez, Pablo Gauna, Gauna Zarate Nicolas, Benjamin, Beatriz, Mia Abigail) comparten el **mismo `cliente_id`** (`0f0b9595-...`). El envio `ADMIN-ENV-20260211-20952C` fue creado manualmente (no tiene orden e-commerce) y su `remitente_id` apunta a ese `cliente_id` compartido.

Al calcular la liquidacion, el sistema busca envios "comunes" (sin orden e-commerce) filtrando por `remitente_id IN [cliente_ids]`. Como todos comparten el mismo `cliente_id`, este envio aparece en la liquidacion de **cualquier** seller que se calcule, incluyendo Gonzalez Carlos cuando en realidad pertenece a Pablo Gauna.

No hay forma automatica de determinar a que seller pertenece un envio manual cuando varios sellers comparten el mismo `cliente_id`.

## Solucion propuesta

### Fix 1: Siempre cargar tarifas de zona

Eliminar la condicion `hasZoneTarifa` y siempre cargar las tarifas de zona del tenant (igual que hace la pestaña "Saldos por Seller"). Ademas, agregar el fallback de zona cuando el seller no tiene `tarifa_id` asignada (linea 529-568 actualmente solo entra si `sellerTarifaId` existe).

### Fix 2: Excluir envios comunes ambiguos

Cuando multiples sellers comparten el mismo `cliente_id`, no incluir envios comunes (manuales) porque es imposible determinar a cual seller pertenecen. Solo incluir envios comunes cuando un unico seller tiene ese `cliente_id`.

Esto evita la atribucion incorrecta. Los envios de e-commerce (vinculados via `ecommerce_orders.seller_id`) seguiran funcionando correctamente porque tienen una relacion directa con el seller.

## Cambios tecnicos

Solo se modifica `src/pages/ecommerce/Settlements.tsx`:

1. **Lineas 504-515**: Eliminar la condicion `hasZoneTarifa` y siempre cargar tarifas de zona del tenant
2. **Lineas 529-568**: Agregar rama `else` cuando `sellerTarifaId` es null, para intentar match por zona con las tarifas del tenant (misma logica que "Saldos por Seller")
3. **Lineas 447-464**: Filtrar envios comunes por `cliente_id` solo cuando ese `cliente_id` es unico a un solo seller. Si multiples sellers comparten el mismo `cliente_id`, excluir los envios comunes de la liquidacion


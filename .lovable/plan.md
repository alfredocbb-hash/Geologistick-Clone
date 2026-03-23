

## Plan: Integrar tarifas exclusivas de seller en el cálculo de liquidaciones

### Problema detectado

El motor de liquidaciones en `Settlements.tsx` busca tarifas de zona para calcular precios, pero carga **todas** las tarifas de zona activas del tenant (línea 639-644 y 174-180) sin distinguir las exclusivas de un seller. Esto causa:

1. Las tarifas exclusivas de Kingdom se mezclan con las generales en el matching de zona
2. No se priorizan las tarifas exclusivas del seller al calcular el precio de sus envíos
3. Si Kingdom tiene tarifas exclusivas con precios distintos (ej: $4,610 vs tarifa general de $3,000), el matching podría tomar la tarifa equivocada

### Cambios

**Archivo: `src/pages/ecommerce/Settlements.tsx`**

#### 1. En el cálculo de saldos (query `seller-tariff-balances`, ~línea 174)
- Cargar tarifas exclusivas por seller: `SELECT * FROM tarifas WHERE seller_exclusivo_id IN (sellerIds) AND activa = true`
- Al calcular precio de cada envío de un seller, primero buscar match en sus tarifas exclusivas
- Solo usar tarifas generales como fallback si no hay exclusivas

#### 2. En la mutación de cálculo de liquidación (`calculateMutation`, ~línea 638)
- Mismo patrón: cargar tarifas exclusivas de los sellers seleccionados
- Al hacer zone matching, priorizar las tarifas exclusivas del seller dueño del envío
- Fallback a tarifas generales solo si no hay match exclusivo

### Lógica de prioridad (ambos lugares)

```text
1. precio_tarifa_vigente (congelado) → usar directamente
2. precio_total > 0 → usar como fallback histórico
3. Si precio = 0:
   a. Buscar en tarifas exclusivas del seller (seller_exclusivo_id = seller.id)
   b. Si no hay match → buscar en tarifa asignada (tarifa_id)
   c. Si no hay match → buscar en tarifas generales de zona (seller_exclusivo_id IS NULL)
```

### Archivos a modificar
- `src/pages/ecommerce/Settlements.tsx` — 2 secciones: query de saldos y mutación de cálculo


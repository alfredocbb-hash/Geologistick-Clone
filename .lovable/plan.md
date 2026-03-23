

## Plan: Flujo de creación de tarifa exclusiva para sellers desde el módulo e-commerce

### Contexto

Hoy el sistema soporta asignar una tarifa a un seller via `tarifa_id` en `ecommerce_sellers`. Pero el flujo es manual: ir a Tarifas, crear 3 tarifas por zona, volver a Sellers, asignar cada una. Para el caso de Beraexpress (3 zonas con precios distintos + recargo por día), esto es tedioso y propenso a error.

El sistema usa **una tarifa = un precio_base + una zona_destino**. Para 3 zonas con 3 precios distintos, se necesitan 3 tarifas separadas tipo "zona". Esto ya funciona con el matching automático de zona.

### Cambios propuestos

#### 1. Nuevo campo `seller_exclusivo_id` en la tabla `tarifas` (migración)

```sql
ALTER TABLE tarifas ADD COLUMN seller_exclusivo_id UUID REFERENCES ecommerce_sellers(id) ON DELETE SET NULL;
```

Esto marca una tarifa como exclusiva de un seller. Las tarifas con este campo:
- No aparecen en el selector general de envíos manuales
- Solo se usan al calcular el precio de envíos de ese seller

#### 2. Wizard "Crear Tarifa para Seller" en EditSellerDialog y CreateSellerDialog

**Archivo:** `src/components/ecommerce/EditSellerDialog.tsx` y `CreateSellerDialog.tsx`

Agregar un botón "Crear tarifa personalizada" junto al selector de tarifa existente. Al hacer clic, abre un diálogo simplificado donde:
- Se crean N tarifas por zona (ej: Zona 1, Zona 2, Zona 3) en un formulario multi-fila
- Cada fila tiene: nombre de zona, ciudades destino (comma-separated), precio base
- Opcionalmente se puede agregar un concepto adicional (ej: "Recargo por día") con monto fijo
- Al guardar, se crean las tarifas con `seller_exclusivo_id` = seller.id y `tipo_tarifa = 'zona'`
- La primera tarifa (zona local) se asigna automáticamente como `tarifa_id` del seller

**Nuevo componente:** `src/components/ecommerce/CreateSellerTarifaDialog.tsx`

#### 3. Filtrar tarifas exclusivas del selector general

**Archivo:** `src/pages/NewShipment.tsx`

Agregar `.is('seller_exclusivo_id', null)` al query de tarifas para que las tarifas exclusivas de sellers no aparezcan en el formulario de envíos manuales.

#### 4. Usar tarifas exclusivas en el cálculo de envíos e-commerce

**Archivo:** `src/components/ecommerce/CreateShipmentFromOrderDialog.tsx`

Cuando se crea un envío desde una orden, si el seller tiene tarifas con `seller_exclusivo_id`, buscar entre esas tarifas la que mejor coincida con la zona destino (usando el algoritmo de matching existente), en lugar de usar solo `tarifa_id`.

#### 5. Concepto "Recargo por día"

Se crea como un `tarifa_concepto` normal con `es_basico = true`. El wizard lo agrega automáticamente como `tarifa_concepto_precios` con el monto configurado, para cada tarifa del grupo. El sistema actual ya suma conceptos básicos al flete.

### Flujo del usuario (ejemplo Beraexpress)

1. Va a Sellers → edita un seller → clic en "Crear tarifa personalizada"
2. Completa 3 filas:
   - Zona 1: "Berazategui" → $4,610.99
   - Zona 2: "Quilmes, Florencio Varela" → $7,370.99
   - Zona 3: "CABA, La Plata, Lomas de Zamora..." → $10,245.99
3. Agrega concepto adicional: "Recargo por día" → $500 (ejemplo)
4. Guarda → se crean 3 tarifas exclusivas + concepto por día asignado a cada una
5. Puede asignar las mismas tarifas a otros sellers con el mismo acuerdo

### Detalle técnico

- **Migración**: 1 ALTER TABLE para agregar `seller_exclusivo_id`
- **Nuevo componente**: `CreateSellerTarifaDialog.tsx` (~300 líneas) con formulario multi-zona
- **Ediciones menores**: filtro en `NewShipment.tsx`, matching mejorado en `CreateShipmentFromOrderDialog.tsx`
- **RLS**: la columna nueva hereda las policies existentes de `tarifas`


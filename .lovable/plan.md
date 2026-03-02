

# Excluir envios con estado "pendiente" de liquidaciones de sellers

## Problema

Los envios con estado "pendiente" (que aun no fueron recogidos por ningun chofer) aparecen en las liquidaciones de sellers y se les asigna un valor. Estos envios no deben liquidarse porque todavia no entraron al circuito operativo.

## Regla de negocio

- **Envio pendiente**: no debe incluirse en el calculo ni en la liquidacion. El paquete aun no fue procesado.
- Solo se liquidan envios que ya pasaron al menos por el estado "recogido" (es decir, que entraron al circuito logistico).

## Cambios

### `src/pages/ecommerce/Settlements.tsx`

**1. Saldos por Seller (sellerBalances, linea ~266-273)**

Agregar condicion: si `envio.estado === 'pendiente'`, saltar (no sumar al total). Similar a como ya se hace con cancelados sin visitas.

```typescript
// Pendiente = no liquidar
if (envio.estado === 'pendiente') {
  continue;
}
```

**2. Calculo de liquidacion (calculateMutation, linea ~540)**

En el mapeo de `allEnviosData`, agregar la exclusion de envios pendientes. Esto se hace filtrando antes de mapear o asignando `precioFinal = 0` con una marca especial.

La solucion mas limpia es filtrar antes del mapeo:
```typescript
const allEnviosData = [...ecommerceEnvios, ...uniqueCommon]
  .filter(e => e.estado !== 'pendiente'); // Excluir pendientes
```

**3. Generacion (generateMutation)**

No requiere cambio adicional: al excluir los pendientes del calculo, estos no llegaran a la generacion.

### `src/components/ecommerce/SellerLiquidacionDetailDialog.tsx`

Para liquidaciones ya generadas que pudieran tener envios pendientes vinculados (datos historicos), agregar la misma logica visual:

- Mostrar envios pendientes con `$0` y tooltip "Pendiente - no se liquida"
- Excluirlos del total ajustado
- Aplicar estilo `opacity-60` similar a cancelados sin visitas

Modificar la funcion `isCancelledNoVisits` para que tambien cubra pendientes, renombrandola a algo mas generico como `isExcludedFromSettlement`:

```typescript
const isExcludedFromSettlement = (envio: any) =>
  envio.estado === 'pendiente' ||
  (envio.estado === 'cancelado' && !(enviosConVisitasSet || new Set()).has(envio.id));
```

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/pages/ecommerce/Settlements.tsx` | Excluir pendientes en `sellerBalances` y `calculateMutation` |
| `src/components/ecommerce/SellerLiquidacionDetailDialog.tsx` | Mostrar pendientes como $0 con indicador visual |

## Sin cambios de base de datos

No se requieren migraciones. Solo se agregan filtros en el frontend.

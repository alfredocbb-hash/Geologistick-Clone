## Causa

En `src/pages/ecommerce/Settlements.tsx` (línea ~166), la query `ecommerce-sellers-cta-cte` que puebla el selector de sellers filtra sólo por `tenant_id` y `tiene_cuenta_corriente = true`, pero **no filtra por `activo = true`**. Por eso aparecen sellers dados de baja mientras conserven cuenta corriente.

## Cambio

Agregar `.eq('activo', true)` a esa query para que:

- La lista "Saldos por Seller"
- El multi-selector "Seleccionar sellers..." de nueva liquidación
- Las KPIs (total saldo, sellers con deuda, sellers a favor)

sólo consideren sellers activos.

Los sellers inactivos con cuenta corriente seguirán existiendo en la base y en el historial de liquidaciones ya generadas; simplemente no aparecerán para nuevas liquidaciones.

## Nota

Reviso también los otros lugares donde se listan sellers para liquidar (por ejemplo el balance dinámico y el detalle de liquidaciones) para confirmar que dependen de esta misma query y no requieren fix adicional. Si aparece otro sitio con el mismo bug (por ejemplo `LiquidacionesEcommerceTab` en Finanzas), lo corrijo en la misma tanda.

## Diagnóstico

El envío `ML-47113271306` (Centro Agricola El Pato) **sigue ligado a una liquidación activa** (`a8f8cd58-5d86-4298-a602-67969938da3b`, estado `generada`) con `monto = $6000`.

La regla "Centro agricola el pato → $3300" **está bien cargada** y el matching la encontraría correctamente. El problema es que el código (línea 522-523 de `DriverSettlements.tsx`) decide:

```ts
estado_liquidacion: comision?.liquidacion_id ? 'liquidado' : 'a_liquidar'
comision_calculada: comision?.liquidacion_id ? (comision.monto ?? recalculado) : recalculado
```

Es decir: si la `comisiones` row tiene `liquidacion_id` no nulo, **muestra el monto histórico congelado y no recalcula nunca**. Cuando vos "eliminaste y volviste a generar", probablemente eliminaste otra liquidación distinta, no la `a8f8cd58…`. Por eso sigue trayendo $6000.

Hay dos cosas que arreglar:

### 1. Liberar el envío de El Pato (acción de datos)

Borrar/anular la liquidación `a8f8cd58…` para que el envío vuelva a `a_liquidar` y, al recalcular, aplique la regla nueva ($3300). Esto requiere un INSERT/DELETE — te pido confirmación antes de tocar nada.

Opciones:
- **A)** Eliminar sólo el row de `comisiones` de este envío (más quirúrgico). El envío queda libre, la liquidación sigue existiendo con los demás envíos.
- **B)** Anular la liquidación `a8f8cd58…` completa (revierte todos los envíos que contiene). Más seguro si no estaba pagada.

Necesito saber:
1. ¿La liquidación `a8f8cd58…` está pagada o sólo "generada"?
2. ¿Querés liberar **sólo** este envío (opción A) o anular toda la liquidación (opción B)?

### 2. Mejora de UI para evitar el bug a futuro

El usuario no tiene forma hoy de saber *por qué* un envío sigue apareciendo con un monto viejo cuando piensa que lo "regeneró". Propongo:

- En la tabla de liquidación, cuando `estado_liquidacion === 'liquidado'`, mostrar también el **número/ID corto de la liquidación que lo contiene** y un botón "Ver liquidación" que abre el detalle. Así si el monto está raro, ves a qué liquidación pertenece.
- Agregar un botón **"Reabrir liquidación" (super_admin)** en el detalle de cada liquidación que esté en estado `generada` (no pagada): borra la liquidación y libera todos los envíos a `a_liquidar`. Hoy no existe ese flujo, por eso vos terminás "eliminando" cosas a mano sin saber qué se libera realmente.

## Archivos a tocar (sólo si confirmás la parte 2)

- `src/pages/DriverSettlements.tsx` — mostrar `liquidacion_id` corto + botón en filas ya liquidadas.
- Nuevo botón "Reabrir liquidación" en el dialog de detalle (`detailLiquidacion`) visible sólo para `super_admin`, que dispara DELETE de la liquidación y limpia `comisiones.liquidacion_id`.

## Confirmación

Decime:
1. **Para el envío El Pato:** ¿opción A (sólo este envío) u opción B (anular toda la liquidación `a8f8cd58…`)?
2. **Para la mejora de UI:** ¿avanzo con el botón "Reabrir liquidación" + el indicador de liquidación en la tabla?

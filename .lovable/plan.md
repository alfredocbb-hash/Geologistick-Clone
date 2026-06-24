## Problema

En la liquidación de Ariel Kersul hay un envío con **pago en destino** pero el botón "Descontar" no apareció, por lo que la cobranza no pudo descontarse de la comisión.

## Causa

En `src/pages/DriverSettlements.tsx` el botón "Descontar" y todos los cálculos COD se basan **solo** en el flag `pago_contra_entrega`:

```ts
{envio.pago_contra_entrega && isALiquidar ? <Button …Descontar… /> : '-'}
```

En la base hay 4 envíos con `tipo_pago = 'destino'` pero `pago_contra_entrega = false` (datos cargados desde OCR / ML / importaciones antiguas donde no se seteó el flag). Para esos envíos el chofer cobra en destino pero la UI no ofrece descontarlo.

## Solución (solo frontend)

Tratar como "pago a descontar" cualquier envío donde `pago_contra_entrega = true` **o** `tipo_pago = 'destino'`.

Cambios en `src/pages/DriverSettlements.tsx`:

1. Agregar `tipo_pago` al `selectFields` (línea ~328) y al tipo `EnvioParaLiquidar` (línea ~70).
2. Propagar `tipo_pago` al objeto retornado (línea ~514) y derivar un campo unificado, ej. `cobra_en_destino = pago_contra_entrega || tipo_pago === 'destino'`.
3. Reemplazar los 4 usos de `e.pago_contra_entrega` (líneas 569, 797, 801, 1077) por `e.cobra_en_destino`.
4. Etiqueta/columna COD: mostrar el mismo importe (`precio_efectivo`) en ambos casos.

No se tocan migraciones ni lógica de negocio del backend — el cálculo de descuento sigue siendo `comisiones − Σ precio_efectivo de envíos marcados`.

## Verificación

- Abrir liquidación de Ariel y confirmar que el envío reportado ahora muestra el botón "Descontar".
- Marcar y comprobar que el saldo final resta correctamente.
- Envíos `contado` / `cuenta_corriente` siguen mostrando "-".
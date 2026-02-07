
# Corregir filtro de pagos pendientes en Gestion de Pagos

## Problema

En la solapa "Pendientes" de Gestion de Pagos, aparecen envios con el boton "Cobrar" aunque ya se hayan cobrado. Esto ocurre porque el filtro actual solo excluye envios con pagos en estado `pagado`, pero no considera otros estados que tambien indican que el cobro fue realizado:

- `cobrado_chofer`: el chofer ya cobro en destino
- `rendido`: el chofer ya rindio ese cobro

Actualmente en la base de datos existen pagos con estado `cobrado_chofer` que siguen apareciendo como pendientes de cobro.

## Solucion

Ampliar el filtro para que excluya envios que tengan un pago en **cualquier** estado que indique cobro realizado: `pagado`, `cobrado_chofer` o `rendido`.

## Cambio tecnico

### Archivo: `src/pages/Payments.tsx`

Modificar la query de filtrado (lineas 242-245):

```
ANTES:
  .eq('estado', 'pagado')

DESPUES:
  .in('estado', ['pagado', 'cobrado_chofer', 'rendido'])
```

Esto es un cambio de una sola linea que asegura que los envios cuyo pago ya fue cobrado por el chofer o ya fue rendido no aparezcan en la lista de pendientes ni muestren el boton "Cobrar".

## Resultado esperado

- Solo apareceran en "Pendientes" los envios que realmente no tienen ningun cobro registrado
- El boton "Cobrar" solo se mostrara para envios que efectivamente necesitan ser cobrados
- Las estadisticas de "Pendientes de Cobro" tambien se actualizaran correctamente ya que usan la misma fuente de datos

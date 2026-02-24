

# Fix: Precio de concepto en $0 no se guarda

## Problema

En la pagina de Tarifas, al editar los precios por concepto, si se pone un valor de $0 (como "Flete" en $0), el sistema no lo guarda. Esto ocurre porque el codigo filtra los conceptos antes de guardarlos y descarta cualquiera donde el monto sea 0.

## Causa raiz

En `src/pages/Rates.tsx`, linea 415, el filtro de guardado es:

```text
.filter(([_, val]) => 
  (val.es_porcentaje && parseFloat(val.porcentaje) > 0) || 
  (!val.es_porcentaje && parseFloat(val.monto) > 0)
)
```

Esto excluye cualquier concepto con monto = 0, por lo que nunca se inserta ni actualiza en la base de datos.

## Solucion

Cambiar el filtro para permitir guardar valores de $0. La logica correcta es: guardar el precio si el usuario lo ha definido (es decir, si existe una entrada en el objeto `conceptPrices` para ese concepto), sin importar si el valor es 0.

El filtro se reemplazara por uno que simplemente verifique que el valor es un numero valido (incluyendo 0):

```text
.filter(([_, val]) => 
  (val.es_porcentaje && parseFloat(val.porcentaje) >= 0) || 
  (!val.es_porcentaje && parseFloat(val.monto) >= 0)
)
```

Esto permite guardar $0 como precio valido para cualquier concepto.

## Archivo a modificar

| Archivo | Accion | Descripcion |
|---|---|---|
| `src/pages/Rates.tsx` | Modificar | Cambiar filtro de `> 0` a `>= 0` en la mutacion de guardado de precios por concepto (linea 415) |

No se requieren cambios en la base de datos.




# Fix: Tarifas para envios Sucursal a Sucursal en BlackBox

## Problema identificado

Cuando se crea un envio "Sucursal a Sucursal", el sistema busca tarifas asignadas a la **sucursal de origen**. La tarifa "De Bsas a Mdq, Bahia blanca, Rosario, Mendoza, Cordoba" tiene "mar del plata" como zona destino, pero **no esta asignada a la sucursal Rosario** en la tabla `sucursal_tarifas`. Por eso Rosario no puede encontrar tarifa para Mar del Plata.

## Solucion

### 1. Correccion de datos: asignar tarifa a Rosario

Insertar el registro faltante en `sucursal_tarifas` para que la sucursal Rosario tenga habilitada la tarifa "De Bsas a Mdq, Bahia blanca, Rosario, Mendoza, Cordoba".

- Sucursal: ROSARIO (SANTA FE) - `89334282-6670-41f2-bdf9-a9cf1518a64c`
- Tarifa: De Bsas a Mdq... - `10e24a96-c522-4df1-88ed-0c042050df41`
- Tenant: BlackBox Cargas - `81be07a7-73a0-4986-994e-5365478343eb`

### 2. Mejora de codigo: busqueda bidireccional para sucursal-a-sucursal

Actualmente el sistema solo busca tarifas del origen. Para envios sucursal-a-sucursal, tambien deberia considerar tarifas asignadas a la sucursal destino que cubran la ruta inversa. Esto evitara que el problema se repita con otras combinaciones.

**Archivo: `src/pages/NewShipment.tsx`**

En la query de `sucursal-tarifas` (linea ~381), cuando el tipo de servicio es `sucursal_sucursal` o `puerta_sucursal`, agregar una segunda consulta que traiga las tarifas habilitadas para la sucursal destino tambien:

```text
Si tipoServicio es sucursal_sucursal y hay sucursal_destino_id:
  1. Traer tarifas habilitadas del origen (actual)
  2. Traer tarifas habilitadas del destino (nuevo)
  3. Combinar ambos conjuntos en tarifasDisponibles (sin duplicados)
```

Esto se implementa agregando una segunda query condicional y fusionando los resultados en el `useMemo` de `tarifasDisponibles`.

## Impacto

- No requiere cambios en la base de datos (esquema)
- Solo se modifica `NewShipment.tsx` para la busqueda bidireccional
- Se inserta un registro de datos para la correccion inmediata de BlackBox

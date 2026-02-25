

# Fix: Pantalla negra al continuar ruta (crash por null pointer)

## Problema

En `ActiveRouteNavigation.tsx`, la seccion "Next Stop Card" (linea 642) se renderiza cuando `nextEnvio` existe **O** cuando `isSucursalStop` es true. Sin embargo, las secciones de "Customer Info" (linea 680-691), "COD badge" (linea 694) y "Notes" (linea 705) acceden directamente a `nextEnvio.nombre_remitente`, `nextEnvio.pago_contra_entrega` y `nextEnvio.notas` **sin verificar que nextEnvio no sea null**.

Cuando la ruta tiene una parada de tipo sucursal como proxima parada, `nextEnvio` es `null`, y acceder a sus propiedades lanza un `TypeError` que crashea React, resultando en la pantalla negra.

Adicionalmente, el componente no tiene proteccion contra errores inesperados, lo que permite que cualquier excepcion no capturada produzca una pantalla en blanco.

## Solucion

| Archivo | Cambio |
|---|---|
| `src/pages/ActiveRouteNavigation.tsx` | Envolver las secciones de Customer Info, COD badge y Notes con condicional `!isSucursalStop` para que solo se rendericen para paradas de envio. Para paradas de sucursal, mostrar el `nombre_parada` en su lugar. Agregar try-catch en la funcion de completar parada de sucursal. |

### Detalle tecnico

En la seccion del "Next Stop Card" (dentro del bloque `(nextEnvio || isSucursalStop)`), reorganizar el contenido para separar la info de sucursal vs envio:

1. **Customer Info (lineas 680-691)**: Mostrar `clienteName` (que ya maneja correctamente el caso sucursal en linea 551-555) en lugar de acceder directamente a `nextEnvio.nombre_remitente`/`nextEnvio.nombre_destinatario`
2. **COD badge (lineas 694-702)**: Envolver con `{nextEnvio?.pago_contra_entrega && ...}` (optional chaining)
3. **Notes (lineas 705-709)**: Envolver con `{nextEnvio?.notas && ...}` (optional chaining)

Esto corrige el crash sin cambiar la logica visual: las paradas de sucursal muestran nombre y direccion, y las de envio muestran la info completa del cliente.

## Correccion adicional: RouteStart.tsx duplicado

En `RouteStart.tsx`, las lineas 268-282 renderizan el bloque de "ENTREGAS" dos veces (duplicado). Se eliminara la segunda aparicion.


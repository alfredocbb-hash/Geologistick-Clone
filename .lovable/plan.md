

# Ocultar "Rendición COD" en Caja si la sucursal no tiene choferes asignados

## Problema
Las sucursales ven el botón "Rendición COD" en la página de Caja aunque no tengan ningún chofer asignado, lo cual no tiene sentido operativo.

## Solución

### Archivo: `src/pages/Cash.tsx`

1. **Agregar una query** que verifique si existen choferes asignados a la sucursal activa
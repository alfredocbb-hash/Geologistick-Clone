

# Fix: Boton "Planificar" navega a ruta incorrecta

## Problema

En la pagina de Pedidos e-Commerce (`src/pages/ecommerce/Orders.tsx`), el boton "Planificar" que aparece al seleccionar pedidos navega a `/route-planner?envios=...`, pero la ruta real del planificador en `App.tsx` es `/planner`.

Por eso al hacer click no se abren los envios en el planificador, sino que se muestra un 404.

## Solucion

Un cambio de una sola linea en `src/pages/ecommerce/Orders.tsx` (linea 443):

Cambiar:
```
navigate(`/route-planner?envios=${envioIds.join(',')}`);
```

Por:
```
navigate(`/planner?envios=${envioIds.join(',')}`);
```

## Sin cambios de base de datos
No se necesitan migraciones.


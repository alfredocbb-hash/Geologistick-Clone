

# Mapa y paradas lado a lado + Envios agrupados por localidad

## Problema
1. Al reordenar paradas manualmente, el mapa queda arriba y hay que hacer scroll constante para ver el resultado.
2. La lista de envios disponibles no permite ver cuantos envios hay por localidad de un vistazo.

## Solucion

### Cambio 1: Layout lado a lado para paradas + mapa

Cuando hay una ruta seleccionada (`selectedOption`), reorganizar la seccion en dos columnas:

```text
+----------------------------------+------------------------------+
|  Opciones de Ruta (cards)                                       |
|  [x] Retiros primero   [ ] Distancia minima                    |
+-----------------------------------------------------------------+
+----------------------------------+------------------------------+
|  Orden de Paradas (drag&drop)    |  Mapa Vista Previa           |
|  1. Marcos Casuso                |  [Google Map reactivo        |
|  2. Mauricio Del Castillo        |   con polyline que se        |
|  3. Maria Mercedes Birello       |   actualiza al reordenar]    |
|  ...                             |                              |
|  (scroll interno en la lista)    |                              |
+----------------------------------+------------------------------+
|  Chofer | Vehiculo | Fecha | Hora | [Crear Ruta]                |
+-----------------------------------------------------------------+
```

- La lista de paradas tendra `max-h-[500px]` con scroll interno
- El mapa ocupara la misma altura (`h-[500px]`) y se actualizara reactivamente al reordenar
- En pantallas chicas (`< lg`) se mantiene apilado vertical

### Cambio 2: Envios agrupados por localidad

Agregar un toggle de vista en la card de "Envios Disponibles" para alternar entre:
- **Vista lista** (actual): tabla plana con todos los envios
- **Vista por localidad**: envios agrupados en secciones colapsables por ciudad, cada seccion muestra la cantidad de envios y permite seleccionar/deseleccionar todos los de esa localidad

```text
+------------------------------------------+
|  Envios Disponibles    [Lista | Localidad]|
+------------------------------------------+
|  > Mar del Plata (5)           [x] Todos |
|    [x] TRK-001  Entrega  Av. Colon 123  |
|    [x] TRK-002  Retiro   Luro 456       |
|    ...                                    |
|  > Buenos Aires (3)            [ ] Todos |
|    [ ] TRK-005  Entrega  Rivadavia 789   |
|    ...                                    |
+------------------------------------------+
```

## Cambios tecnicos en `src/pages/RoutePlanner.tsx`

### Para el layout lado a lado:
1. Agregar un estado `viewGrouped` (boolean) para alternar vistas
2. Cuando `selectedOption` existe, envolver la card de paradas y un nuevo bloque de mapa en `grid lg:grid-cols-2 gap-4`
3. El mapa de la columna derecha reutiliza los mismos `mapMarkers` y `routePolyline` que ya se calculan reactivamente
4. La seccion de asignacion (chofer, vehiculo, fecha, hora, boton crear) queda debajo del grid a ancho completo

### Para envios agrupados por localidad:
1. Agregar estado `groupByCity` (boolean, default false)
2. Calcular `groupedEnvios` con `useMemo`: agrupar `filteredEnvios` por ciudad (usando `ciudad_entrega` o `ciudad_retiro` segun el tipo)
3. Renderizar con `Collapsible` de Radix: cada grupo es colapsable con checkbox de "seleccionar todos" del grupo
4. Toggle con dos botones (Lista / Localidad) en el header de la card

## Archivo a modificar

| Archivo | Cambio |
|---|---|
| `src/pages/RoutePlanner.tsx` | Layout 2 columnas para paradas+mapa; vista agrupada por localidad en envios disponibles |


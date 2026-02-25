
# Incluir Sucursales como Paradas en Rutas Planificadas

## Resumen

Permitir agregar sucursales como paradas dentro de una ruta planificada en el Planificador de Rutas. El chofer podra pasar por sucursales a recoger o dejar paquetes como parte de su recorrido, y las sucursales participaran en la optimizacion por distancia igual que cualquier envio.

## Cambios en la base de datos

Se necesita una migracion para modificar la tabla `ruta_paradas`:

1. Hacer `envio_id` **nullable** (actualmente es obligatorio)
2. Agregar columna `sucursal_id UUID` (nullable, FK a `sucursales`)
3. Agregar columna `nombre_parada TEXT` (para mostrar el nombre de la sucursal en la UI)
4. Agregar constraint CHECK: al menos uno de `envio_id` o `sucursal_id` debe tener valor

```text
ALTER TABLE ruta_paradas ALTER COLUMN envio_id DROP NOT NULL;
ALTER TABLE ruta_paradas ADD COLUMN sucursal_id UUID REFERENCES sucursales(id);
ALTER TABLE ruta_paradas ADD COLUMN nombre_parada TEXT;
-- Validacion: al menos uno de los dos debe tener valor
ALTER TABLE ruta_paradas ADD CONSTRAINT chk_envio_or_sucursal 
  CHECK (envio_id IS NOT NULL OR sucursal_id IS NOT NULL);
```

## Cambios en el frontend

| Archivo | Accion | Descripcion |
|---|---|---|
| `src/pages/RoutePlanner.tsx` | Modificar | Agregar seccion de seleccion de sucursales como paradas, integrarlas en la optimizacion y en la creacion de la ruta |
| `src/pages/ActiveRouteNavigation.tsx` | Modificar | Manejar paradas de tipo "sucursal" (sin envio asociado) en la vista de navegacion activa |
| `src/pages/RouteStart.tsx` | Modificar | Mostrar paradas de sucursal en el resumen previo al inicio |
| `src/pages/PrintPlannedRoute.tsx` | Modificar | Mostrar paradas de sucursal en la impresion |
| `src/components/routes/EditRouteDialog.tsx` | Modificar | Permitir ver/eliminar paradas de sucursal al editar una ruta |

### Detalle del Planificador (RoutePlanner.tsx)

1. **Seleccion de sucursales**: En la seccion de "Crear" ruta, debajo de la lista de envios, agregar un area "Sucursales en ruta" con checkboxes para seleccionar sucursales (excluyendo la de origen). Cada sucursal mostrara su nombre, ciudad y cantidad de envios pendientes.

2. **Tipo de parada**: Al seleccionar una sucursal, se le asigna `tipo: "sucursal"` en el modelo `RouteStop`. Se extiende la interfaz:

```text
interface RouteStop {
  envio_id: string;        // vacio para sucursales
  sucursal_id?: string;    // ID de la sucursal (nuevo)
  tipo: "retiro" | "entrega" | "sucursal";  // nuevo tipo
  direccion: string;
  lat: number;
  lng: number;
  cliente_nombre: string;  // nombre de la sucursal
  telefono: string;
  tracking: string;        // vacio para sucursales
}
```

3. **Optimizacion**: Las sucursales participan en el algoritmo nearest-neighbor como cualquier otra parada. Se integran en ambas opciones de ruta.

4. **Creacion**: Al insertar en `ruta_paradas`, las paradas de sucursal usan `sucursal_id` en vez de `envio_id`, con `tipo = 'sucursal'` y `nombre_parada` con el nombre de la sucursal.

### Detalle de Navegacion Activa (ActiveRouteNavigation.tsx)

- Al iterar `paradasRuta`, detectar si `envio_id` es null y `sucursal_id` no es null
- Mostrar la parada como tipo "Sucursal" con icono `Building2`
- No mostrar acciones de entrega/retiro/incidencia para paradas de sucursal
- Mostrar boton "Llegue" para marcar la parada como completada (actualizar `estado = 'completada'`)
- En el mapa, usar icono de tipo `branch` para estas paradas

### Detalle de RouteStart y PrintPlannedRoute

- Mostrar paradas de sucursal con badge "Sucursal" y el nombre correspondiente
- No contar como retiro ni entrega en las estadisticas, mostrar como categoria separada

### Detalle de EditRouteDialog

- Listar paradas de sucursal junto a las de envio
- Permitir eliminarlas (borrar el registro de `ruta_paradas`)
- No permitir "agregar" sucursales desde este dialogo (se hace desde el planificador)



## Plan: Editar horario de entrega manualmente en el Planificador

### Problema
Cuando la API de ML no devuelve `time_frame`, los envíos aparecen sin horario en el Planificador y no hay forma de asignarlo manualmente.

### Solución
Hacer clickeable la celda "Horario" en la tabla de envíos del Planificador. Al hacer click, mostrar un popover/select que permita:
1. Elegir una preferencia horaria (Mañana, Tarde, Noche, Comercial)
2. Opcionalmente ingresar rango exacto (HH:MM desde/hasta)
3. Guardar directamente en la tabla `envios` via Supabase update

### Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/RoutePlanner.tsx` | Reemplazar la celda estática de "Horario" (líneas 1652-1665) por un componente clickeable con popover que muestre un Select de preferencia + inputs de hora desde/hasta, y al confirmar haga `supabase.from('envios').update(...)` |

### Detalle técnico
- La celda mostrará el horario actual (si existe) o un botón "Asignar"
- Al clickear se abre un `Popover` con:
  - `Select` con opciones: Mañana (08:00-13:00), Tarde (13:00-20:00), Noche (20:00-23:00), Comercial (09:00-18:00), Personalizado
  - Si elige "Personalizado", aparecen 2 inputs tipo `time` para desde/hasta
- Al confirmar, actualiza `envios` con `horario_preferido_entrega`, `horario_entrega_desde`, `horario_entrega_hasta`
- Invalida el query de envíos para refrescar la tabla
- No requiere cambios de base de datos (los campos ya existen)


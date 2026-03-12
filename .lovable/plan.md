

# Habilitar "Rutas de Entrega" para sucursales con servicio de última milla

## Situación actual

- El menú "Rutas de Entrega" (`/routes`) ya existe en el sidebar (línea 110) pero **no tiene** `requiresBranchDelivery: true`, por lo que aparece para todos.
- La página `Routes.tsx` muestra **todos** los envíos sin asignar del sistema, sin filtrar por sucursal ni tipo de servicio.
- Las sucursales que "Realizan Entregas" necesitan ver solo los envíos que están físicamente en su sucursal y que requieren entrega a domicilio.

## Cambios propuestos

### 1. `src/components/layout/AppSidebar.tsx` — Condicionar visibilidad

Agregar `requiresBranchDelivery: true` al item "Rutas de Entrega" (línea 110-114) para que solo aparezca cuando la sucursal tiene "Realiza Entregas" habilitado (o para super admin).

### 2. `src/pages/Routes.tsx` — Filtrar envíos por sucursal y tipo de servicio

Modificar la query de envíos sin asignar para que, cuando el usuario tiene una sucursal asignada:

- Filtre por `sucursal_entrega_id = sucursal_id` del usuario (envíos físicamente en su sucursal).
- Filtre por `tipo_servicio_detalle` que implique entrega a domicilio: `sucursal_puerta`, `puerta_puerta`, `domicilio_domicilio`.
- Mantenga el comportamiento global para super admin / admin sin sucursal.

```typescript
// Para usuarios con sucursal: solo envíos en su sucursal + tipo domicilio
const query = supabase.from('envios').select(...)
  .is('chofer_id', null)
  .in('estado', ['pendiente', 'recogido', 'en_sucursal'])
  .in('tipo_servicio_detalle', ['sucursal_puerta', 'puerta_puerta', 'domicilio_domicilio']);

if (profile?.sucursal_id) {
  query.or(`sucursal_entrega_id.eq.${profile.sucursal_id},sucursal_destino_id.eq.${profile.sucursal_id}`);
}
```

También filtrar los choferes mostrados a los de la misma sucursal del usuario (cuando aplique).

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/layout/AppSidebar.tsx` | Agregar `requiresBranchDelivery: true` al item "Rutas de Entrega" |
| `src/pages/Routes.tsx` | Filtrar envíos por sucursal del usuario + tipo servicio a domicilio, y choferes por sucursal |


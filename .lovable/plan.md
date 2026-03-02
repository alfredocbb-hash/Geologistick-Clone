

# Fix: Remover condición de filtro demasiado amplia

## Problema

La condición agregada `(envio.estado === 'pendiente' && !envio.chofer_id)` muestra envíos ML nuevos (como el 46566297799) que aún no fueron recolectados del seller. Esto satura el planificador con envíos no accionables.

## Solución

**Archivo:** `src/pages/RoutePlanner.tsx` (línea 272)

Remover la línea:
```typescript
(envio.estado === 'pendiente' && !envio.chofer_id) ||
```

Los envíos de la ruta cancelada de Lucas Galarza ya fueron corregidos a `en_sucursal` por la migración SQL, así que pasan el filtro existente en línea 269. No se necesita esta condición adicional.

El filtro queda con las condiciones originales que ya cubren todos los casos:
- Estados avanzados (`recogido`, `en_sucursal`, `en_reparto`)
- Envíos reprogramados (`reprogramado_count > 0`)
- Envíos con `ultima_reprogramacion`
- Envíos no-ML (manuales)


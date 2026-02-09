

# Fix: Nombres de Choferes en Reportes

## Problema
En la solapa "Rendimiento de Choferes", todos los choferes aparecen como **"Sin nombre"** porque la consulta a la tabla `profiles` busca por la columna `id` (clave primaria interna), pero `envios.chofer_id` almacena el `user_id` (ID de autenticacion).

Ejemplo real del problema:
- `envios.chofer_id` = `2c007134-cfbe-4872-a19a-7301d7c33b8c`
- `profiles.user_id` = `2c007134-cfbe-4872-a19a-7301d7c33b8c` (Valentina Castano)
- `profiles.id` = `f842ac80-5620-46fe-81b1-fc2cabb7ae18` (no coincide)

## Solucion

Cambiar una sola linea en `src/hooks/useReportsData.ts`:

**Linea 158 actual:**
```typescript
.in('id', choferIds);
```

**Cambiar a:**
```typescript
.in('user_id', choferIds);
```

Y ajustar la linea 162 donde se construye el `profileMap` para usar `user_id` como clave del mapa en lugar de `id`:

**Actual:**
```typescript
const profileMap = new Map((profiles || []).map(p => [p.id, `${p.nombre || ''} ${p.apellido || ''}`.trim() || 'Sin nombre']));
```

**Cambiar a:**
```typescript
const profileMap = new Map((profiles || []).map(p => [p.user_id, `${p.nombre || ''} ${p.apellido || ''}`.trim() || 'Sin nombre']));
```

## Impacto
- Solo se modifica `src/hooks/useReportsData.ts`
- Correccion de 2 lineas
- Sin cambios en la UI ni en otros archivos


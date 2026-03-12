

# Permitir cerrar rutas confirmadas con fechas viejas

## Problema

El botón "Cerrar Ruta" solo aparece para rutas con estado `en_curso` (línea 1998 de RoutePlanner.tsx). Las dos primeras rutas en la screenshot (RP-20260310-8401 y RP-20260311-0728) tienen estado `confirmada` con fechas 10/03 y 11/03 (anteriores a hoy 12/03), por eso no muestran el botón. Solo la tercera ruta (RP-20260312-5746) está `en_curso` y sí lo muestra.

## Cambios

### 1. Migración SQL: actualizar `close_ruta_planificada`

Actualmente el RPC solo permite cerrar rutas `en_curso`. Hay que permitir también `confirmada`:

```sql
-- Antes:
IF v_ruta.estado != 'en_curso' THEN ...

-- Después:
IF v_ruta.estado NOT IN ('en_curso', 'confirmada') THEN ...
```

### 2. UI: ampliar condición del botón en `RoutePlanner.tsx` (línea 1998)

Mostrar "Cerrar Ruta" para admins cuando:
- Estado `en_curso` (cualquier fecha), **o**
- Estado `confirmada` con fecha anterior a hoy

```typescript
// Antes:
{ruta.estado === 'en_curso' && (roles.includes('admin') || roles.includes('super_admin')) && (

// Después:
{(roles.includes('admin') || roles.includes('super_admin')) && 
 (ruta.estado === 'en_curso' || 
  (ruta.estado === 'confirmada' && new Date(ruta.fecha) < startOfDay(new Date()))) && (
```

**Archivos modificados:**
- SQL migration (actualizar RPC `close_ruta_planificada`)
- `src/pages/RoutePlanner.tsx` (una línea de condición)


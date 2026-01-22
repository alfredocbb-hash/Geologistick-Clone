
# Plan: Corregir Visualización de Rutas Activas

## Diagnóstico del Problema

El administrador no ve las rutas activas porque la query usa un **estado incorrecto**.

### Query actual (línea 239 de RoutePlanner.tsx):
```tsx
.in("estado", ["confirmada", "en_progreso"])
```

### Estados reales en la base de datos:
| Estado | Significado |
|--------|-------------|
| `confirmada` | Ruta creada, aún no iniciada por el chofer |
| `en_curso` | Ruta iniciada, el chofer está en reparto |
| `completada` | Ruta finalizada |

El código busca `en_progreso` pero el estado correcto es **`en_curso`**.

---

## Solución

Modificar la query en `src/pages/RoutePlanner.tsx` línea 239:

**Antes:**
```tsx
.in("estado", ["confirmada", "en_progreso"])
```

**Después:**
```tsx
.in("estado", ["confirmada", "en_curso"])
```

---

## Archivo a Modificar

| Archivo | Línea | Cambio |
|---------|-------|--------|
| `src/pages/RoutePlanner.tsx` | 239 | Cambiar `en_progreso` por `en_curso` |

---

## Resultado Esperado

Con este cambio, el administrador verá:
- Rutas recién creadas (estado `confirmada`)
- Rutas en reparto (estado `en_curso`)

Las 2 rutas activas actuales aparecerán en la pestaña "Rutas Activas":
- `RP-20260122-4353`
- `RP-20260122-5725`

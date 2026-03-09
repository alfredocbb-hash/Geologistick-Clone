

# Fix: Sidebar se abre solo al volver a la pestaña

## Causa raíz

El `SidebarProvider` en `sidebar.tsx` **escribe** el estado del sidebar en una cookie (`sidebar:state`) cuando cambia, pero **nunca lee** esa cookie al inicializarse. Siempre arranca con `defaultOpen = true`.

Cuando el usuario vuelve a la pestaña, los refetch globales causan re-renders. Si algún estado transitorio provoca un remount del `SidebarProvider`, el sidebar se resetea a abierto.

## Solución

### 1. `src/components/layout/DashboardLayout.tsx` — Leer la cookie y pasarla como `defaultOpen`

Antes de renderizar `SidebarProvider`, leer la cookie `sidebar:state` y usar su valor como prop:

```typescript
function getSidebarCookieState(): boolean {
  const match = document.cookie.match(/sidebar:state=(true|false)/);
  return match ? match[1] === 'true' : true; // default: abierto
}

// En el componente:
<SidebarProvider defaultOpen={getSidebarCookieState()}>
```

Esto es un cambio mínimo de ~5 líneas en un solo archivo. No se modifica `sidebar.tsx` (archivo auto-generado de shadcn).

### 2. `src/hooks/useSubscriptionBlock.ts` — Agregar `refetchOnWindowFocus: false`

Este hook puede causar re-renders innecesarios al volver a la pestaña. Agregar la protección:

```typescript
refetchOnWindowFocus: false,
```

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/layout/DashboardLayout.tsx` | Leer cookie y pasar `defaultOpen` |
| `src/hooks/useSubscriptionBlock.ts` | `refetchOnWindowFocus: false` |


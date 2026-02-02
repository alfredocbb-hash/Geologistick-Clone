

# Plan: Corregir Parpadeo de Pantalla y Pérdida de Datos al Cambiar de Ventana

## Problema Identificado

El sistema experimenta parpadeo (flashing) y pérdida de datos al:
1. Navegar entre módulos del sistema
2. Cambiar a otra pestaña del navegador o programa del escritorio
3. Volver a la aplicación después de minimizarla

## Causas Raíz

### Causa 1: QueryClient sin configuración de caché adecuada
El `QueryClient` se crea sin opciones, lo que significa que:
- `staleTime` es 0 (los datos se marcan como "stale" inmediatamente)
- `refetchOnWindowFocus` está activado por defecto
- `gcTime` (garbage collection) es muy corto

**Resultado**: Cada vez que cambias de ventana y vuelves, React Query refetch todos los datos, causando parpadeo.

### Causa 2: Invalidación agresiva en visibilitychange
En `MobileAppLayout.tsx` hay un listener que invalida queries cuando la app vuelve a estar visible:
```typescript
if (document.visibilityState === 'visible') {
  queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
  queryClient.invalidateQueries({ queryKey: ['user-roles'] });
}
```

### Causa 3: Estado local en componentes
Muchas páginas (como `RoutePlanner`) usan `useState` para datos que deberían persistir:
```typescript
const [selectedEnvios, setSelectedEnvios] = useState<string[]>([]);
const [selectedChofer, setSelectedChofer] = useState<string>("");
```
Cuando el componente se desmonta (navegación) o se re-renderiza, este estado se pierde.

---

## Solución Propuesta

### Paso 1: Configurar QueryClient con opciones de caché

Modificar la creación del `QueryClient` en `src/App.tsx` para agregar configuración global:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos: datos frescos por más tiempo
      gcTime: 10 * 60 * 1000,   // 10 minutos: mantener en caché
      refetchOnWindowFocus: false, // NO refetch al volver a la ventana
      refetchOnReconnect: true,   // SÍ refetch al reconectar internet
      retry: 1, // Reintentar solo 1 vez en error
    },
  },
});
```

### Paso 2: Eliminar invalidación agresiva en visibilitychange

Modificar `src/components/mobile/MobileAppLayout.tsx` para NO invalidar todas las queries al cambiar de visibilidad:

```typescript
// ELIMINAR este bloque:
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
    }
  };
  // ...
}, [queryClient]);
```

O si es necesario refrescar permisos, hacerlo de forma menos agresiva:
```typescript
// Refetch en vez de invalidar (no borra el caché mientras carga)
queryClient.refetchQueries({ queryKey: ['user-permissions'], type: 'active' });
```

### Paso 3: Usar `placeholderData` en queries críticas

Para páginas con datos pesados, agregar `placeholderData` para evitar el flash de loading:

```typescript
const { data: envios } = useQuery({
  queryKey: ['envios-planificador'],
  queryFn: fetchEnvios,
  placeholderData: (previousData) => previousData, // Mantener datos anteriores
});
```

### Paso 4: Persistir estado de selección en sessionStorage (opcional)

Para páginas como `RoutePlanner` donde las selecciones son importantes:

```typescript
// Crear hook usePersistedState
function usePersistedState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(() => {
    const saved = sessionStorage.getItem(key);
    return saved ? JSON.parse(saved) : initialValue;
  });
  
  useEffect(() => {
    sessionStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  
  return [state, setState] as const;
}

// Uso:
const [selectedEnvios, setSelectedEnvios] = usePersistedState<string[]>('planner-selected', []);
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | Configurar QueryClient con staleTime, gcTime, refetchOnWindowFocus |
| `src/components/mobile/MobileAppLayout.tsx` | Eliminar o suavizar invalidación en visibilitychange |
| `src/hooks/usePersistedState.ts` (nuevo) | Hook para persistir estado en sessionStorage |
| `src/pages/RoutePlanner.tsx` | Usar usePersistedState para selecciones críticas |

---

## Impacto Esperado

| Antes | Después |
|-------|---------|
| Flash de loading al cambiar de ventana | Datos permanecen visibles |
| Selecciones perdidas al navegar | Selecciones persisten en sesión |
| Refetch innecesarios | Caché de 5 minutos |
| UX frustrante | Experiencia fluida |

---

## Diagrama de Flujo

```text
ANTES:
┌─────────────────────────────────────────────────────────┐
│ Usuario cambia a otra pestaña                           │
│                    ↓                                    │
│ Usuario vuelve a la app                                 │
│                    ↓                                    │
│ visibilitychange dispara invalidateQueries              │
│                    ↓                                    │
│ Todos los datos se marcan como "stale"                  │
│                    ↓                                    │
│ React Query hace refetch de TODO                        │
│                    ↓                                    │
│ Pantalla muestra "Cargando..." (FLASH)                  │
│                    ↓                                    │
│ Datos cargan de nuevo (pero selecciones se perdieron)   │
└─────────────────────────────────────────────────────────┘

DESPUÉS:
┌─────────────────────────────────────────────────────────┐
│ Usuario cambia a otra pestaña                           │
│                    ↓                                    │
│ Usuario vuelve a la app                                 │
│                    ↓                                    │
│ staleTime = 5min → datos siguen "frescos"               │
│                    ↓                                    │
│ refetchOnWindowFocus = false → NO refetch               │
│                    ↓                                    │
│ Pantalla muestra datos del caché (SIN FLASH)            │
│                    ↓                                    │
│ Selecciones persisten (sessionStorage)                  │
└─────────────────────────────────────────────────────────┘
```


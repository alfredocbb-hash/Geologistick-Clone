

# Corregir cierre de sesion que no se completa correctamente

## Problema

Al cerrar sesion:
1. Se muestra "Hola, Usuario!" con datos en cero (el perfil se borra localmente)
2. Pero el usuario NO es redirigido al login (la sesion sigue activa internamente)
3. Al refrescar la pagina, vuelve a iniciar como "Alfredo" porque la sesion nunca se elimino realmente del navegador

## Causa raiz

La funcion `signOut` en `src/lib/auth.tsx` solo limpia `profile` y `roles`, pero **no limpia** `user` ni `session` directamente. Depende de que el evento `onAuthStateChange` lo haga, pero si `supabase.auth.signOut()` falla silenciosamente (por error de red, timeout, etc.), la sesion queda guardada en el navegador y el usuario nunca es redirigido.

Ademas, el cache de datos (React Query) no se limpia al cerrar sesion, lo que puede causar que datos del usuario anterior se muestren brevemente si alguien inicia sesion con otra cuenta.

## Solucion

### 1. Mejorar la funcion `signOut` en `src/lib/auth.tsx`

- Limpiar **todos** los estados (`user`, `session`, `profile`, `roles`) de forma inmediata, sin depender del evento `onAuthStateChange`
- Manejar errores de `supabase.auth.signOut()` para que si falla, igual se limpie el estado local
- Limpiar la cache de React Query al cerrar sesion para evitar datos residuales

### 2. Actualizar `AppHeader.tsx`

- Asegurar que la navegacion a `/login` ocurra incluso si `signOut()` lanza un error

## Seccion tecnica

### Archivo: `src/lib/auth.tsx`

La funcion `signOut` cambia de:

```typescript
const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
};
```

A una version robusta que:
1. Limpia `user`, `session`, `profile` y `roles` de inmediato (antes de esperar a Supabase)
2. Envuelve `supabase.auth.signOut()` en un try/catch para que errores de red no bloqueen el cierre
3. Invalida el cache de React Query

Se necesita recibir el `queryClient` como parametro o importarlo. La opcion mas limpia es que `signOut` reciba el `queryClient` como argumento opcional, o acceder a el via el contexto.

Alternativa: exponer `signOut` de forma que el componente que lo llama (AppHeader) tambien limpie el cache.

### Archivo: `src/components/layout/AppHeader.tsx`

Actualizar `handleSignOut` para:
1. Limpiar el cache de React Query usando `useQueryClient()`
2. Navegar a `/login` en un bloque `finally` para garantizar la redireccion

```
ANTES:
const handleSignOut = async () => {
    await signOut();
    navigate('/login');
};

DESPUES:
const handleSignOut = async () => {
    try {
      queryClient.clear();
      await signOut();
    } catch (e) {
      console.error('Error during sign out:', e);
    } finally {
      navigate('/login', { replace: true });
    }
};
```

### Archivo: `src/components/layout/AppSidebar.tsx`

El boton de logout en el sidebar (linea 417) llama directamente a `signOut()` sin navegar ni limpiar cache. Se debe actualizar para usar la misma logica robusta:

```
ANTES:
<Button ... onClick={signOut} ...>

DESPUES:
<Button ... onClick={handleSignOut} ...>
```

Donde `handleSignOut` es una funcion local que limpia cache, llama a signOut, y navega a `/login`.

## Resultado esperado

- Al hacer clic en "Cerrar Sesion" (desde el header o el sidebar), el usuario sera redirigido inmediatamente al login
- La sesion se eliminara del navegador correctamente
- Si se refresca la pagina despues de cerrar sesion, NO volvera a la cuenta anterior
- Los datos en cache se limpian para evitar filtracion de informacion entre sesiones

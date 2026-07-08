
## Problemas detectados

1. **Sellers pueden ver Liquidaciones eCommerce (y otras vistas admin)**
   - `DashboardLayout` (`src/components/layout/DashboardLayout.tsx`) sólo valida `user` + suscripción. No revisa roles.
   - `Login.tsx` redirige a `/seller` sólo cuando el usuario tiene **exclusivamente** `seller`, pero si el seller navega manualmente a `/ecommerce/settlements`, `/finanzas`, `/dashboard`, etc., entra al layout admin. La página `ecommerce/Settlements.tsx` no tiene guard de rol (sólo confía en RLS).
   - Resultado: `pruebafull@beraexpress.com` puede ver la pantalla de liquidaciones eCommerce.

2. **Sellers/usuarios inactivos siguen entrando**
   - `SellerLayout` chequea `hasRole('seller')` y `seller` existente, pero **no** `seller.activo`. Un seller marcado inactivo en `ecommerce_sellers` mantiene su sesión y sigue entrando.
   - `AuthProvider` / `DashboardLayout` no chequean `profiles.activo`. Un usuario cualquiera desactivado desde `/admin/users` sigue teniendo sesión y navegando.

## Solución

### A. Guard de rol para el layout admin
- En `DashboardLayout`: si el usuario tiene rol `seller` y **ningún** rol admin/operativo (admin, super_admin, supervisor, operador, chofer, bodega, despachador, atencion_cliente, sucursal, cliente), redirigir a `/seller`. Esto cubre `/ecommerce/settlements`, `/finanzas`, `/dashboard` y cualquier otra ruta bajo el layout.
- Complementar en `ecommerce/Settlements.tsx` con un guard explícito `isAdmin() || isSuperAdmin()` → `Navigate` a `/dashboard`, igual que hace `Finanzas.tsx`, para defender en profundidad contra futuras rutas.

### B. Bloqueo de usuarios inactivos (a nivel app)
- En `AuthProvider.fetchUserData`: si `profiles.activo === false`, forzar `signOut()` y limpiar estado. Mostrar toast "Tu cuenta fue desactivada. Contactá al administrador."
- Añadir el mismo check en `DashboardLayout` y `SellerLayout` como fallback (por si `activo` cambia durante la sesión y llega vía `refetch`).

### C. Bloqueo de sellers inactivos
- En `SellerLayout`: si `seller.activo === false`, forzar `signOut()` y redirigir a `/login` con toast "Tu tienda fue desactivada."
- En `useSellerData`: exponer `seller.activo` (ya lo hace) y agregar `refetchOnWindowFocus: true` en el query del seller para detectar la desactivación sin recargar.

### D. Revalidación periódica
- En `AuthProvider`, agregar un `refetchInterval` liviano (cada 60s) o revalidar `profiles.activo` en cada `SIGNED_IN`/`TOKEN_REFRESHED`. Con esto una desactivación del admin cierra la sesión activa en la próxima ventana de refresco (max ~1 minuto).

## Archivos a modificar
- `src/components/layout/DashboardLayout.tsx` — guard de rol + chequeo `profiles.activo`.
- `src/components/seller/SellerLayout.tsx` — chequeo `seller.activo` + signOut.
- `src/lib/auth.tsx` — signOut automático si `profiles.activo === false`; revalidación periódica.
- `src/pages/ecommerce/Settlements.tsx` — guard `isAdmin/isSuperAdmin`.
- `src/hooks/useSellerData.ts` — `refetchOnWindowFocus`.

## Notas
- Sólo cambios de frontend/presentación. No se tocan RLS ni migraciones (RLS ya filtra datos; esto corrige la superficie visual y el acceso indebido).
- El super_admin sigue con acceso irrestricto (no se le aplica el guard de seller).

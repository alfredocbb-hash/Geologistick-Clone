

# Restringir banners de suscripcion solo a administradores

## Problema

El componente `TrialBanner` muestra avisos de vencimiento de suscripcion y periodo de prueba a **todos los usuarios** del tenant, incluyendo despachantes, operadores de sucursal, choferes, etc. Solo los administradores deberian ver estos mensajes ya que son los unicos que pueden gestionar la suscripcion.

## Solucion

Modificar `src/components/trial/TrialBanner.tsx` para importar `useAuth` y verificar que el usuario tenga rol `admin` o `super_admin` antes de renderizar cualquier banner.

## Cambio tecnico

**Archivo: `src/components/trial/TrialBanner.tsx`**

1. Importar `useAuth` desde `@/lib/auth`
2. Obtener `isAdmin` del hook
3. Agregar una condicion temprana: si el usuario no es admin, retornar `null` inmediatamente (despues del check de loading y antes de cualquier renderizado de banner)

```typescript
const { isAdmin } = useAuth();
// ... existing hooks ...

if (trialLoading || subLoading || dismissed) return null;
if (!isAdmin()) return null;  // Solo admins ven banners de suscripcion
```

Esto afecta los 4 escenarios del banner:
- Suscripcion vencida
- Suscripcion por vencer (5 dias o menos)
- Trial expirado
- Trial activo

Ninguno sera visible para usuarios no-admin.


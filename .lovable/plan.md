
# Plan: Super Admin Siempre Ve Branding Geologistick

## Problema

Cuando un Super Admin está logueado, ve el branding de la empresa asociada a su perfil en lugar del branding neutro de Geologistick. Esto causa confusión porque:

1. Si una empresa cambia su logo, el Super Admin ve ese cambio
2. El Super Admin debería ver siempre la marca "Geologistick" como plataforma neutral
3. Los colores y estilos de otras empresas afectan la interfaz del Super Admin

## Solución

Modificar el hook `useTenant` para que cuando el usuario sea Super Admin, no cargue el branding de ningún tenant específico, permitiendo que la interfaz use los valores por defecto de Geologistick.

## Cambios Técnicos

### Archivo: `src/hooks/useTenant.ts`

Agregar verificación de `isSuperAdmin()` para evitar cargar branding cuando el usuario es Super Admin:

```typescript
export function useTenant() {
  const { user, profile, isSuperAdmin } = useAuth();
  const tenantId = (profile as { tenant_id?: string })?.tenant_id;

  // Super Admin siempre ve branding por defecto
  const shouldLoadBranding = !isSuperAdmin();

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    // ...
    enabled: !!user && !!tenantId && shouldLoadBranding,
  });

  const { data: branding, isLoading: brandingLoading } = useQuery({
    // ...
    enabled: !!user && !!tenantId && shouldLoadBranding,
  });

  return {
    tenant,
    branding,
    tenantId,
    isLoading: shouldLoadBranding ? (tenantLoading || brandingLoading) : false,
  };
}
```

## Comportamiento Resultante

| Usuario | Logo | Colores | Favicon |
|---------|------|---------|---------|
| Super Admin | Geologistick (default) | Azul/Default | Geologistick |
| Admin Empresa A | Logo Empresa A | Colores Empresa A | Favicon A |
| Admin Empresa B | Logo Empresa B | Colores Empresa B | Favicon B |

## Archivo a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useTenant.ts` | Agregar condición `isSuperAdmin()` para deshabilitar carga de branding |

## Impacto

- Los Super Admins verán siempre la interfaz estándar de Geologistick
- Los usuarios normales seguirán viendo el branding de su empresa
- No afecta la funcionalidad de personalización en el panel de administración de cada empresa

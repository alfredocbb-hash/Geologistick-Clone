
# Plan: Corregir Visibilidad del Módulo e-Commerce para Super Admin

## Problema Identificado

El módulo e-Commerce no es visible para Super Admins porque la verificación de `requiresEcommerce` ocurre antes del bypass de super_admin en la función `canAccessGroup`.

**Flujo actual (incorrecto):**
```text
canAccessGroup(e-Commerce)
  ├─ ¿superAdminOnly? → No
  ├─ ¿requiresEcommerce && !tenant.ecommerce_enabled? → SÍ → return false ❌
  └─ ¿isSuperAdmin()? → (nunca se evalúa)
```

**Flujo corregido:**
```text
canAccessGroup(e-Commerce)
  ├─ ¿superAdminOnly? → No
  ├─ ¿isSuperAdmin()? → SÍ → return true ✓
  └─ ¿requiresEcommerce && !ecommerce_enabled? → (solo para usuarios normales)
```

---

## Solución

### Archivo: `src/components/layout/AppSidebar.tsx`

Mover la verificación `isSuperAdmin()` al inicio de la función para que los Super Admins tengan acceso a TODAS las secciones.

**Cambio en líneas 268-280:**

```typescript
const canAccessGroup = (group: NavGroup) => {
  // Super Admin only section
  if (group.superAdminOnly) {
    return isSuperAdmin();
  }
  
  // Super Admin can see everything (moved BEFORE ecommerce check)
  if (isSuperAdmin()) return true;
  
  // e-Commerce section requires tenant to have ecommerce_enabled
  // (only applies to non-super-admin users now)
  if (group.requiresEcommerce && !tenant?.ecommerce_enabled) {
    return false;
  }
  
  if (!group.permissionKeys || group.permissionKeys.length === 0) return true;
  return group.permissionKeys.some(key => hasPermission(key));
};
```

---

## Cambio Específico

| Línea | Antes | Después |
|-------|-------|---------|
| 274-277 | Verifica `requiresEcommerce` antes de `isSuperAdmin()` | Verifica `isSuperAdmin()` antes de `requiresEcommerce` |

---

## Comportamiento Resultante

| Usuario | Tenant con e-Commerce | Tenant sin e-Commerce |
|---------|----------------------|----------------------|
| Super Admin | Ve e-Commerce | **Ve e-Commerce** (corregido) |
| Admin | Ve e-Commerce | No ve e-Commerce |
| Otros roles | Según permisos | No ve e-Commerce |

---

## Impacto

- **Super Admins** podrán ver y gestionar el módulo e-Commerce sin importar la configuración del tenant actual
- Usuarios normales seguirán viendo el módulo solo si su tenant lo tiene habilitado
- No afecta otras secciones ni permisos


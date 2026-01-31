
# Plan: Restringir Personalización a Super Admin + Agregar Toggle Claro/Oscuro

## Situación Actual

1. **Personalización completa** (`/admin/branding`) es accesible por cualquier admin de empresa
2. **No existe** un toggle de tema claro/oscuro en la interfaz web
3. El Super Admin ya tiene un diálogo de personalización por empresa (`TenantBrandingDialog`)

## Cambios Propuestos

### 1. Restringir Acceso al Módulo de Personalización

**Archivo: `src/components/layout/AppSidebar.tsx`**

Cambiar el ítem "Personalización" del menú para que solo sea visible para Super Admins:

```text
Antes:
  Administración
  ├─ Personalización (permissionKey: 'integrations.manage')

Después:
  Super Admin
  ├─ Empresas
  ├─ Planes
  ├─ Landing Page
  ├─ Personalización ← Mover aquí (superAdminOnly: true)
```

**Archivo: `src/pages/BrandingSettings.tsx`**

Cambiar la verificación de permisos:
- Antes: `if (!isAdmin())` → Acceso denegado
- Después: `if (!isSuperAdmin())` → Acceso denegado

Además, agregar selector de empresa para que el Super Admin pueda elegir qué tenant personalizar.

### 2. Agregar Toggle de Tema para Usuarios Normales

**Nuevo componente: `src/components/theme/ThemeToggle.tsx`**

Un simple toggle con iconos Sol/Luna que alterna entre modo claro y oscuro.

**Ubicación del toggle:**
- En la página de Perfil (`src/pages/Profile.tsx`) - nueva sección "Preferencias"
- En el header del Dashboard (`src/components/layout/AppHeader.tsx`) - botón rápido

**Implementación técnica:**
- Usar `next-themes` (ya está instalado, usado en `sonner.tsx`)
- Agregar `ThemeProvider` en `App.tsx`
- Persistir preferencia en localStorage

### 3. Flujo de Trabajo

```text
┌─────────────────────────────────────────────────────────────────┐
│  SUPER ADMIN                                                    │
├─────────────────────────────────────────────────────────────────┤
│  ● Puede acceder a /admin/branding                              │
│  ● Ve selector de empresa para elegir cuál personalizar         │
│  ● Puede cambiar logos, colores, SEO, contacto, etc.            │
│  ● También puede usar TenantBrandingDialog desde Empresas       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ADMIN / USUARIOS DE EMPRESA                                    │
├─────────────────────────────────────────────────────────────────┤
│  ● NO pueden acceder a /admin/branding                          │
│  ● Solo ven el toggle Claro/Oscuro en su perfil o header        │
│  ● El branding de su empresa es aplicado automáticamente        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | Agregar `ThemeProvider` de next-themes |
| `src/pages/BrandingSettings.tsx` | Restringir a Super Admin + agregar selector de tenant |
| `src/components/layout/AppSidebar.tsx` | Mover "Personalización" a sección Super Admin |
| `src/components/layout/AppHeader.tsx` | Agregar botón toggle de tema |
| `src/pages/Profile.tsx` | Agregar sección "Preferencias" con toggle de tema |
| `src/components/theme/ThemeToggle.tsx` | Nuevo componente para el toggle |

---

## Detalles Técnicos

### ThemeProvider en App.tsx

```typescript
import { ThemeProvider } from 'next-themes';

// Envolver la app
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  <AuthProvider>
    {/* ... resto */}
  </AuthProvider>
</ThemeProvider>
```

### ThemeToggle Component

```typescript
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Cambiar tema</span>
    </Button>
  );
}
```

### BrandingSettings con Selector de Tenant

Para Super Admins, agregar un Select al inicio de la página que liste todas las empresas y permita seleccionar cuál personalizar:

```typescript
// Solo para Super Admin
const { data: tenants } = useQuery({
  queryKey: ['tenants-list'],
  queryFn: async () => {
    const { data } = await supabase.from('tenants').select('id, nombre').order('nombre');
    return data;
  },
  enabled: isSuperAdmin(),
});

// Select para elegir tenant
<Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
  {tenants?.map(t => (
    <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
  ))}
</Select>
```

---

## Resultado Final

| Usuario | Personalización | Toggle Tema |
|---------|-----------------|-------------|
| Super Admin | Acceso completo a `/admin/branding` con selector de empresa | Si |
| Admin Empresa | Sin acceso | Si |
| Usuarios | Sin acceso | Si |

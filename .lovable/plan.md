
# Extraer plantilla de diseño reutilizable

Objetivo: generar un paquete portable con el sistema de diseño (tema, tokens, componentes UI, layout de dashboard) para pegar en otro proyecto Lovable/Vite+React sin arrastrar lógica de negocio (envíos, sellers, ML, etc.).

## Qué incluye el paquete

Se creará una carpeta `template-package/` en la raíz del proyecto con:

1. **Design tokens y tema**
   - `src/index.css` limpio (variables HSL claro/oscuro, tipografías, radios, sombras).
   - `tailwind.config.ts` con la extensión de colores semánticos, animaciones y plugins usados.
   - `postcss.config.js`.

2. **Componentes UI base (shadcn)**
   - Toda la carpeta `src/components/ui/` (button, card, dialog, dropdown, table, tabs, toast, sonner, form, input, select, sidebar, etc.).
   - `src/hooks/use-toast.ts` y `src/hooks/use-mobile.tsx`.
   - `src/lib/utils.ts` (`cn`).

3. **Layout de dashboard genérico**
   - Versión desacoplada de `DashboardLayout` con sidebar + topbar + theme toggle, sin referencias a tenants ni permisos por rol.
   - `ThemeProvider` + `ThemeToggle` (light / dark / system) sin dependencias externas.
   - Página de ejemplo `DashboardExample.tsx` con cards, tabla y KPIs para mostrar el look & feel.

4. **Config base**
   - `package.json` mínimo (React 18, Vite 5, Tailwind 3, shadcn deps, lucide-react, react-router-dom, @tanstack/react-query, next-themes).
   - `vite.config.ts`, `tsconfig.json`, `components.json` (shadcn), `.gitignore`.
   - `main.tsx` y `App.tsx` de ejemplo con router + query client + theme provider.

5. **README de instalación**
   - `template-package/README.md` con pasos para:
     - Crear un proyecto nuevo en Lovable (o Vite local).
     - Copiar el contenido de `template-package/` sobre la raíz.
     - Ejecutar `npm install` y `npm run dev`.
     - Cómo agregar páginas nuevas usando el layout.

## Qué NO incluye (a propósito)

- Nada de `src/pages/` de negocio (envíos, liquidaciones, facturación, ML, MP, choferes, tenants).
- Ninguna migración SQL, edge function, RLS, ni integraciones (Supabase, ARCA, ML, MP).
- Ningún hook/servicio específico del dominio (`useShipments`, `useTenant`, etc.).
- Assets con marca (logos de Geologistick / Beraexpress).

## Cómo lo usás después

Opción A — Proyecto nuevo en Lovable:
1. Crear proyecto vacío.
2. Conectar a GitHub, hacer un commit con el contenido de `template-package/` reemplazando la raíz.
3. Lovable sincroniza y ya tenés el mismo look.

Opción B — Descargar ZIP:
1. Bajar el código actual desde el Code Editor de Lovable (botón *Download codebase*) o vía GitHub.
2. Copiar solo la carpeta `template-package/` a tu nuevo repo.

## Detalles técnicos

- Se mantiene el mismo esquema HSL semántico ya unificado (`--background`, `--foreground`, `--primary`, `--secondary`, `--accent`, `--muted`, `--border`, `--ring`, `--sidebar-*`) para que cualquier componente shadcn nuevo herede el tema.
- `ThemeProvider` seguirá basado en `next-themes` con `attribute="class"` y `defaultTheme="system"`, igual que hoy.
- El `DashboardLayout` genérico expone `children`, un array `navItems` configurable y un slot para logo/título — sin acoplarse a `TenantProvider` ni a permisos por rol.
- Se dejará `components.json` apuntando a `src/components/ui` para que `npx shadcn@latest add ...` siga funcionando en el proyecto destino.

## Entregable

Al terminar tendrás la carpeta `template-package/` lista para copiar. No se modifica nada del proyecto actual (Geologistick sigue igual); es solo material adicional para exportar.

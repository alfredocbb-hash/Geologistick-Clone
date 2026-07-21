# App Template

Plantilla reutilizable con el sistema de diseño de Geologistick: tema claro/oscuro unificado, tokens semánticos HSL, componentes shadcn/ui completos y un layout de dashboard genérico. **No incluye lógica de negocio** (envíos, sellers, integraciones): sólo la base visual.

## Contenido

```
template-package/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
├── components.json          # config shadcn para agregar más componentes
└── src/
    ├── main.tsx / App.tsx
    ├── index.css            # tokens HSL light/dark
    ├── components/
    │   ├── ui/              # 49 componentes shadcn listos
    │   ├── theme/ThemeToggle.tsx
    │   └── layout/DashboardLayout.tsx
    ├── hooks/               # use-toast, use-mobile
    ├── lib/utils.ts         # cn()
    └── pages/DashboardExample.tsx
```

## Uso en un proyecto Lovable nuevo

1. Crear un proyecto vacío en Lovable.
2. Conectarlo a GitHub (menú **+ → GitHub → Connect project**).
3. Clonar el repo localmente, copiar el contenido de `template-package/` a la raíz reemplazando lo generado por Lovable, hacer commit y push.
4. Lovable sincroniza automáticamente y ya tenés la plantilla.

## Uso en un proyecto Vite local

```bash
cp -r template-package/ mi-nueva-app
cd mi-nueva-app
npm install
npm run dev
```

Abrir `http://localhost:8080`.

## Agregar componentes shadcn adicionales

```bash
npx shadcn@latest add <componente>
```

`components.json` ya apunta a `src/components/ui`.

## Agregar páginas nuevas

1. Crear un archivo en `src/pages/MiPagina.tsx`.
2. Registrar la ruta en `src/App.tsx` dentro de `<Routes>`.
3. Agregar el ítem en el array `navItems` de la página que use `DashboardLayout` (podés extraerlo a un archivo compartido si crece).

Ejemplo:

```tsx
import { DashboardLayout, NavItem } from "@/components/layout/DashboardLayout";
import { Home } from "lucide-react";

const navItems: NavItem[] = [{ label: "Inicio", to: "/", icon: Home }];

export default function MiPagina() {
  return (
    <DashboardLayout title="Mi App" navItems={navItems}>
      <h1 className="text-2xl font-bold">Hola mundo</h1>
    </DashboardLayout>
  );
}
```

## Personalizar el tema

Editar las variables HSL en `src/index.css` (`:root` y `.dark`). Todos los componentes toman los colores desde ahí — cambiando `--primary` cambia botones, links, focus rings, sidebar activo, etc.

## Qué NO incluye

- Backend (Supabase, edge functions, migraciones, RLS).
- Integraciones externas (Mercado Libre, Mercado Pago, ARCA, Google Maps).
- Páginas de negocio (envíos, liquidaciones, facturación).
- Hooks de dominio (`useShipments`, `useTenant`, etc.).

Todo eso se agrega según lo necesite el nuevo proyecto.

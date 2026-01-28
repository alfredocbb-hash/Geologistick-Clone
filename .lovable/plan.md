

# Plan: Landing Page Editable por Super Admin

## Resumen

Crear un sistema que permita al Super Admin editar todo el contenido de la página principal (landing page) desde un panel de administración, incluyendo textos del Hero, secciones de Features, y configuraciones generales.

## Estado Actual

| Componente | Estado | Fuente de Datos |
|------------|--------|-----------------|
| Precios | Dinámico | `subscription_plans` (ya implementado) |
| Hero | Hardcodeado | Código |
| Features | Hardcodeado | Código |
| Navbar | Hardcodeado | Código |
| Footer | Parcialmente dinámico | `tenant_branding` |

## Solución Propuesta

### Parte 1: Nueva Tabla `landing_content`

Crear una tabla para almacenar el contenido de la landing page:

```sql
CREATE TABLE landing_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL UNIQUE, -- 'hero', 'features', 'general'
  content jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- RLS: Lectura pública, escritura solo super_admin
```

Estructura del contenido por sección:

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Estructura de Datos                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  section: 'hero'                                                │
│  ├── badge_text: "Plataforma #1 de Logística"                   │
│  ├── title_line1: "El futuro de la"                             │
│  ├── title_line2: "logística inteligente"                       │
│  ├── description: "Transforma tu operación..."                  │
│  ├── cta_primary: "Comenzar gratis"                             │
│  ├── cta_secondary: "Explorar features"                         │
│  └── stats: [{ value: "+50K", label: "Envíos/mes" }, ...]       │
│                                                                 │
│  section: 'features'                                            │
│  ├── badge_text: "Potenciado por tecnología..."                 │
│  ├── title: "Todo lo que necesitas..."                          │
│  ├── subtitle: "Herramientas profesionales..."                  │
│  └── items: [{ icon: "Package", title: "...", desc: "..." }]    │
│                                                                 │
│  section: 'general'                                             │
│  ├── trial_days: 14                                             │
│  ├── trial_text: "14 días gratis en todos los planes"          │
│  ├── contact_email: "soporte@..."                               │
│  └── currency_label: "ARS"                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Parte 2: Panel de Administración

Crear `LandingContentAdmin.tsx` con pestañas para editar cada sección:

- **Hero**: Textos, badge, CTAs, estadísticas
- **Features**: Lista de características con iconos
- **General**: Configuraciones de trial, moneda, emails

### Parte 3: Actualizar Componentes de Landing

Modificar los componentes para que lean del hook `useLandingContent()`:

- `Hero.tsx` - leer contenido dinámico
- `Features.tsx` - leer lista de features dinámico
- `Pricing.tsx` - ya lee de BD, agregar textos editables

## Archivos a Crear/Modificar

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| Migracion SQL | Crear | Tabla `landing_content` con RLS |
| `src/hooks/useLandingContent.ts` | Crear | Hook para leer contenido de landing |
| `src/pages/LandingContentAdmin.tsx` | Crear | Panel de edicion para super admin |
| `src/components/landing/Hero.tsx` | Modificar | Leer contenido dinamico |
| `src/components/landing/Features.tsx` | Modificar | Leer features dinamicos |
| `src/components/landing/Pricing.tsx` | Modificar | Leer textos editables |
| `src/App.tsx` | Modificar | Agregar ruta `/admin/landing` |
| `src/components/layout/AppSidebar.tsx` | Modificar | Agregar enlace para super admin |

## Detalles Tecnicos

### Migracion SQL

```sql
-- Tabla para contenido de landing page
CREATE TABLE IF NOT EXISTS landing_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL UNIQUE,
  content jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE landing_content ENABLE ROW LEVEL SECURITY;

-- Lectura publica (landing es publica)
CREATE POLICY "Anyone can view landing content"
  ON landing_content FOR SELECT
  USING (true);

-- Solo super_admin puede modificar
CREATE POLICY "Super admins can manage landing content"
  ON landing_content FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Insertar contenido inicial
INSERT INTO landing_content (section, content) VALUES
('hero', '{
  "badge_text": "Plataforma #1 de Logística en Argentina",
  "title_line1": "El futuro de la",
  "title_line2": "logística inteligente",
  "description": "Transforma tu operación con tecnología de punta. Optimización de rutas con IA, tracking en tiempo real y automatización total.",
  "cta_primary": "Comenzar gratis",
  "cta_secondary": "Explorar features",
  "stats": [
    { "value": "+50K", "label": "Envíos/mes", "icon": "Package" },
    { "value": "99.9%", "label": "Uptime", "icon": "Shield" },
    { "value": "< 2s", "label": "Tiempo respuesta", "icon": "Zap" }
  ]
}'::jsonb),
('features', '{
  "badge_text": "Potenciado por tecnología de punta",
  "title": "Todo lo que necesitas para escalar tu operación",
  "subtitle": "Herramientas profesionales diseñadas para empresas que quieren dominar la logística del futuro.",
  "contact_text": "¿Necesitas una integración especial?",
  "contact_cta": "Hablemos de tu caso"
}'::jsonb),
('general', '{
  "trial_days": 14,
  "trial_text": "14 días gratis en todos los planes",
  "pricing_title": "Precios transparentes",
  "pricing_subtitle": "Sin sorpresas ni costos ocultos. Escala cuando lo necesites.",
  "currency_label": "ARS"
}'::jsonb);
```

### Hook useLandingContent

```typescript
// src/hooks/useLandingContent.ts
export function useLandingContent() {
  return useQuery({
    queryKey: ['landing-content'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landing_content')
        .select('*');
      if (error) throw error;
      
      // Convertir array a objeto por seccion
      return data.reduce((acc, row) => {
        acc[row.section] = row.content;
        return acc;
      }, {} as Record<string, any>);
    },
    staleTime: 5 * 60 * 1000, // Cache 5 minutos
  });
}
```

### Panel de Administracion

El panel tendra 3 tabs:
1. **Hero**: Editar badge, titulos, descripcion, CTAs
2. **Features**: Ver lista y poder editar textos de header (features individuales quedan en codigo por iconos)
3. **General**: Dias de trial, textos de pricing, moneda

## Beneficios

- Super Admin puede cambiar textos sin deploy
- Precios ya estan dinamicos en BD
- Features principales mantienen iconos consistentes
- RLS garantiza que solo super_admin puede editar

## Complejidad

| Aspecto | Valor |
|---------|-------|
| Riesgo | Bajo |
| Archivos nuevos | 2 |
| Archivos modificados | 5 |
| Tiempo estimado | 45 minutos |


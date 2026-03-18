

## Plan: Agregar campo "Visible en página principal" a los planes de suscripción

### Cambios necesarios

**1. Migración de base de datos**
Agregar columna `visible_in_landing` (boolean, default `true`) a la tabla `subscription_plans`.

```sql
ALTER TABLE subscription_plans ADD COLUMN visible_in_landing boolean NOT NULL DEFAULT true;
```

**2. Formulario de crear/editar plan** (`src/pages/SubscriptionPlansAdmin.tsx`)
- Agregar un nuevo Switch debajo del switch "Plan activo" con label "Visible en página principal"
- Incluir `visible_in_landing` en `formData` y en la lógica de insert/update

**3. Tabla de planes** (`src/pages/SubscriptionPlansAdmin.tsx`)
- Agregar columna "Visibilidad" en la tabla mostrando un badge (Público / Oculto)

**4. Landing page - Pricing** (`src/components/landing/Pricing.tsx`)
- Filtrar por `.eq("visible_in_landing", true)` además de `is_active`

**5. Otros consumidores** (`src/hooks/useSubscription.ts`, `src/pages/SystemSettings.tsx`)
- Estos muestran planes activos para asignación interna, NO necesitan filtrar por `visible_in_landing` (el plan oculto debe seguir siendo asignable)

### Resultado
- Podrás crear planes que no aparezcan en la landing pero sí estén disponibles para asignar manualmente a tenants desde el panel de super admin.



# Plan: Corrección de 3 Problemas

## Problema 1: APK redirige al dominio

### Causa
La configuración de Capacitor (`capacitor.config.ts`) tiene definida la URL remota apuntando a:
```typescript
server: {
  url: 'https://geologic.lovable.app?forceHideBadge=true',
  cleartext: true
}
```

Esta configuración hace que el APK cargue la aplicación desde el dominio publicado en lugar de los archivos locales. Si el dominio cambió recientemente o hay problemas de red, la app no funcionará correctamente.

### Solución
Actualizar la URL en `capacitor.config.ts` para que apunte a la URL correcta o eliminarla para usar los archivos locales empaquetados.

**Opción A**: Usar archivos locales (recomendado para producción):
```typescript
const config: CapacitorConfig = {
  appId: 'com.geologic.choferapp',
  appName: 'ChoferApp',
  webDir: 'dist',
  // Sin server.url = usa archivos locales
  plugins: { ... }
};
```

**Opción B**: Mantener URL remota pero actualizar al dominio correcto:
```typescript
server: {
  url: 'https://TU-DOMINIO-CORRECTO.com?forceHideBadge=true',
  cleartext: true
}
```

### Archivo a modificar
- `capacitor.config.ts` (líneas 7-10)

---

## Problema 2: Cambiar nombre de LogiTrack a Geologistick

### Archivos a modificar

| Archivo | Línea | Cambio |
|---------|-------|--------|
| `src/components/landing/Navbar.tsx` | 37 | `"LogiTrack"` → `"Geologistick"` |
| `src/components/landing/Footer.tsx` | 9-11 | Valores por defecto |
| `src/components/auth/LoginForm.tsx` | 85 | Título del login |
| `src/components/layout/AppSidebar.tsx` | 312, 346 | Fallback del sidebar |
| `src/pages/BrandingSettings.tsx` | 49 | Default del formulario |
| `src/pages/SystemSettings.tsx` | 117 | Nombre en información |
| `src/pages/TrackingEmbed.tsx` | 295 | "Powered by..." |
| `src/pages/Tracking.tsx` | 332 | Footer de tracking |

### Edge Functions (User-Agent)
| Archivo | Línea |
|---------|-------|
| `supabase/functions/tiendanube-oauth/index.ts` | 197, 241 |
| `supabase/functions/tiendanube-webhook/index.ts` | 80 |
| `supabase/functions/tiendanube-sync/index.ts` | 114 |

### Migración SQL necesaria
Actualizar valores por defecto en la base de datos:
```sql
-- Actualizar default en tenant_branding
ALTER TABLE tenant_branding 
  ALTER COLUMN nombre_app SET DEFAULT 'Geologistick';

-- Actualizar branding existente que use LogiTrack
UPDATE tenant_branding 
SET nombre_app = 'Geologistick' 
WHERE nombre_app = 'LogiTrack';

-- Actualizar nombres de planes de suscripción
UPDATE subscription_plans 
SET name = REPLACE(name, 'LogiTrack', 'Geologistick');
```

---

## Problema 3: Seller ve todos los envíos de la sucursal

### Causa raíz
La consulta en `SellerShipments.tsx` usa:
```typescript
.eq('remitente_id', seller.id)
```

Pero `remitente_id` es un UUID que referencia a la tabla `clientes`, NO a `ecommerce_sellers`. Por lo tanto, el filtro no funciona y las políticas RLS devuelven todos los envíos del tenant.

### Solución
Filtrar los envíos a través de la tabla `ecommerce_orders` que SÍ tiene la relación correcta:
- `ecommerce_orders.seller_id` → vincula al seller
- `ecommerce_orders.envio_id` → vincula al envío

### Cambio en `src/pages/seller/SellerShipments.tsx`

**Antes (incorrecto):**
```typescript
const { data, error } = await supabase
  .from('envios')
  .select(`...`)
  .eq('remitente_id', seller.id)  // ❌ remitente_id es de clientes, no sellers
```

**Después (correcto):**
```typescript
// Primero obtener los envio_ids vinculados a este seller
const { data: orders } = await supabase
  .from('ecommerce_orders')
  .select('envio_id')
  .eq('seller_id', seller.id)
  .not('envio_id', 'is', null);

const envioIds = orders?.map(o => o.envio_id).filter(Boolean) || [];

if (envioIds.length === 0) return [];

const { data, error } = await supabase
  .from('envios')
  .select(`...`)
  .in('id', envioIds)  // ✓ Filtrar solo envíos vinculados
```

### Alternativa: Agregar columna seller_id a envios
Para una solución más robusta a futuro, se puede agregar una columna `seller_id` directamente en la tabla `envios` y actualizar las políticas RLS. Esto permitiría:
- Consultas más simples
- Políticas RLS que incluyan al seller

```sql
-- Agregar columna
ALTER TABLE envios ADD COLUMN seller_id UUID REFERENCES ecommerce_sellers(id);

-- Política RLS para sellers
CREATE POLICY "Sellers pueden ver sus propios envíos"
ON envios FOR SELECT
USING (
  seller_id IS NOT NULL 
  AND seller_id = (
    SELECT id FROM ecommerce_sellers WHERE user_id = auth.uid()
  )
);
```

---

## Resumen de archivos a modificar

### Componentes React (7 archivos)
1. `src/components/landing/Navbar.tsx`
2. `src/components/landing/Footer.tsx`
3. `src/components/auth/LoginForm.tsx`
4. `src/components/layout/AppSidebar.tsx`
5. `src/pages/BrandingSettings.tsx`
6. `src/pages/SystemSettings.tsx`
7. `src/pages/seller/SellerShipments.tsx`

### Páginas de tracking (2 archivos)
8. `src/pages/TrackingEmbed.tsx`
9. `src/pages/Tracking.tsx`

### Edge Functions (3 archivos)
10. `supabase/functions/tiendanube-oauth/index.ts`
11. `supabase/functions/tiendanube-webhook/index.ts`
12. `supabase/functions/tiendanube-sync/index.ts`

### Configuración Capacitor (1 archivo)
13. `capacitor.config.ts`

### Migración SQL (1 migración)
14. Actualizar defaults y datos existentes

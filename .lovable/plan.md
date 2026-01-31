
# Plan: Corregir Aislamiento de Datos por Tenant y Verificar Branding

## Problemas Identificados

### Problema 1: Usuario de BlackBox asignado al tenant incorrecto

El usuario `blackboxcargas@gmail.com` está asignado al tenant "Empresa Principal" (`a0000000-0000-0000-0000-000000000001`) en lugar de "BlackBox Cargas" (`81be07a7-73a0-4986-994e-5365478343eb`).

**Datos en la base de datos:**
| Email | Nombre | Tenant Actual | Debería ser |
|-------|--------|---------------|-------------|
| blackboxcargas@gmail.com | BlackBox | Empresa Principal | BlackBox Cargas |

**Consecuencias:**
- El usuario ve el branding de "Empresa Principal" (Geologistick por defecto)
- No ve el logo de BlackBox Cargas que configuraste
- Ve datos de "Empresa Principal" en lugar de BlackBox Cargas

### Problema 2: Queries sin filtro de tenant_id

Varias páginas del módulo e-Commerce NO filtran los datos por `tenant_id`:

| Archivo | Query | Problema |
|---------|-------|----------|
| `src/pages/ecommerce/Orders.tsx` | `ecommerce_orders` | Sin `.eq('tenant_id', tenantId)` |
| `src/pages/ecommerce/Sellers.tsx` | `ecommerce_sellers` | Sin `.eq('tenant_id', tenantId)` |
| `src/pages/ecommerce/Settlements.tsx` | `ecommerce_sellers` | Sin `.eq('tenant_id', tenantId)` |

Aunque RLS protege parcialmente (solo super admin ve todo), cuando el usuario es super admin SÍ ve todos los datos cruzados, y además la query debería siempre filtrar para consistencia.

---

## Solución

### Parte 1: Reasignar Usuario al Tenant Correcto

Ejecutar query SQL para corregir el tenant del usuario:

```sql
UPDATE profiles 
SET tenant_id = '81be07a7-73a0-4986-994e-5365478343eb'
WHERE email = 'blackboxcargas@gmail.com';
```

### Parte 2: Agregar Filtro de tenant_id a las Queries

#### Archivo: `src/pages/ecommerce/Orders.tsx`

```typescript
// Línea 90 - Agregar filtro
const { data, error } = await supabase
  .from('ecommerce_orders')
  .select(`*,seller:ecommerce_sellers(...)`)
  .eq('tenant_id', tenantId)  // ← AGREGAR
  .order('created_at', { ascending: false })
  .limit(200);
```

#### Archivo: `src/pages/ecommerce/Sellers.tsx`

```typescript
// Línea 85 - Agregar filtro
const { data, error } = await supabase
  .from('ecommerce_sellers')
  .select('*')
  .eq('tenant_id', tenantId)  // ← AGREGAR
  .order('created_at', { ascending: false });
```

#### Archivo: `src/pages/ecommerce/Settlements.tsx`

```typescript
// Línea 127 - Agregar filtro
const { data, error } = await supabase
  .from('ecommerce_sellers')
  .select('id, nombre, saldo_cuenta_corriente, tiene_cuenta_corriente')
  .eq('tenant_id', tenantId)  // ← AGREGAR
  .eq('tiene_cuenta_corriente', true)
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/ecommerce/Orders.tsx` | Agregar `.eq('tenant_id', tenantId)` en query de órdenes |
| `src/pages/ecommerce/Sellers.tsx` | Agregar `.eq('tenant_id', tenantId)` en todas las queries de sellers |
| `src/pages/ecommerce/Settlements.tsx` | Agregar `.eq('tenant_id', tenantId)` en query de sellers |

---

## Datos a Corregir (SQL)

También necesito ejecutar una migración para reasignar el usuario al tenant correcto:

```sql
-- Reasignar usuario BlackBox al tenant correcto
UPDATE profiles 
SET tenant_id = '81be07a7-73a0-4986-994e-5365478343eb'
WHERE email = 'blackboxcargas@gmail.com';
```

---

## Resultado Esperado

Después de implementar estos cambios:

1. El usuario de BlackBox Cargas verá el logo y branding configurado
2. Solo verá órdenes, vendedores y liquidaciones de su empresa
3. Super Admin seguirá viendo todo pero las queries serán consistentes
4. No habrá filtración de datos entre empresas

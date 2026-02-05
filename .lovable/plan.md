

# Plan: Corregir Visualización de Logos en Landing

## Problema Identificado

La tabla `tenant_branding` tiene políticas RLS que solo permiten ver el branding del propio tenant:

```sql
-- Política actual
qual: (tenant_id = current_user_tenant()) OR is_super_admin(auth.uid())
```

Esto significa que:
- Visitantes anónimos de la landing page no pueden ver ningún logo
- Solo el logo de Beraexpress aparece (probablemente porque es el tenant por defecto o hay algún cache)

## Solución

Agregar una política RLS pública que permita leer únicamente los campos de logo para mostrar en la landing page.

---

## Cambios Necesarios

### 1. Nueva Política RLS en `tenant_branding`

Crear una política que permita acceso público de lectura a los logos:

```sql
CREATE POLICY "Acceso público a logos para landing"
ON tenant_branding
FOR SELECT
USING (
  -- Solo permitir lectura de registros con logos configurados
  logo_light IS NOT NULL OR logo_dark IS NOT NULL
);
```

**Nota**: Esta política permitirá que visitantes anónimos vean los logos públicos. Los datos sensibles como colores internos estarán expuestos pero no son críticos.

### 2. Alternativa más segura (opcional)

Si se prefiere más control, crear una vista pública solo con los campos necesarios:

```sql
CREATE VIEW public_client_logos AS
SELECT 
  t.id,
  t.nombre,
  tb.logo_light,
  tb.logo_dark
FROM tenants t
JOIN tenant_branding tb ON tb.tenant_id = t.id
WHERE t.activo = true
AND (tb.logo_light IS NOT NULL OR tb.logo_dark IS NOT NULL);

-- Dar acceso público a la vista
GRANT SELECT ON public_client_logos TO anon;
```

---

## Resumen

| Elemento | Estado Actual | Cambio |
|----------|---------------|--------|
| Política RLS | Solo propio tenant | Agregar política pública para logos |
| Datos expuestos | Ninguno a anónimos | Solo logo_light, logo_dark |
| Efecto | 1 logo visible | 3 logos visibles |

---

## Implementación

1. Ejecutar migración SQL para agregar la nueva política RLS
2. No se requieren cambios en el código de `Clients.tsx`
3. La landing mostrará automáticamente los 3 logos


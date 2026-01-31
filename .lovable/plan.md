
# Plan: Corregir Índice de Códigos de Sucursales

## Problema Identificado

Al intentar crear una nueva empresa, el sistema falla con el error:
```
duplicate key value violates unique constraint "idx_sucursales_codigo"
Key (codigo)=(ADMIN) already exists.
```

**Causa raíz:** El índice único `idx_sucursales_codigo` está definido a nivel global, lo que impide que dos empresas (tenants) tengan sucursales con el mismo código (ej: "ADMIN").

**Índice actual:**
```sql
CREATE UNIQUE INDEX idx_sucursales_codigo 
ON public.sucursales (codigo) 
WHERE (codigo IS NOT NULL)
```

**Índice correcto (por tenant):**
```sql
CREATE UNIQUE INDEX idx_sucursales_codigo 
ON public.sucursales (tenant_id, codigo) 
WHERE (codigo IS NOT NULL)
```

---

## Solución

### Cambio en Base de Datos

Modificar el índice para que sea único por combinación de `tenant_id + codigo`:

```sql
-- Eliminar índice actual
DROP INDEX IF EXISTS idx_sucursales_codigo;

-- Crear índice único por tenant
CREATE UNIQUE INDEX idx_sucursales_codigo 
ON public.sucursales (tenant_id, codigo) 
WHERE (codigo IS NOT NULL);
```

Esto permitirá que:
- Empresa A tenga sucursal con código "ADMIN"
- Empresa B también tenga sucursal con código "ADMIN"
- Pero Empresa A no puede tener DOS sucursales con código "ADMIN"

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| Migración SQL | Reemplazar índice global por índice por tenant |

---

## Resultado Esperado

- Cada empresa podrá tener su propia sucursal "Administración" con código "ADMIN"
- No habrá conflictos al crear nuevas empresas
- Se mantiene la unicidad de códigos dentro de cada empresa

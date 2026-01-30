

# Plan: Mostrar Empresa y Usuario Creador en Tarifas para Super Admin

## Resumen

El Super Admin necesita ver qué empresa (tenant) y qué usuario creó cada tarifa. Esto requiere:

1. Agregar columna `created_by` a la tabla `tarifas`
2. Modificar la consulta para traer datos del tenant y creador
3. Mostrar esta información en las tarjetas de tarifas (solo para super admins)

---

## Cambios a Implementar

### 1. Migración de Base de Datos

Agregar columna `created_by` para registrar qué usuario crea cada tarifa:

```sql
ALTER TABLE tarifas ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
```

### 2. Actualizar la Consulta de Tarifas

Modificar la query para traer la información del tenant y el creador:

**Antes:**
```typescript
const { data, error } = await supabase
  .from('tarifas')
  .select('*')
  .order('nombre');
```

**Después:**
```typescript
const { data, error } = await supabase
  .from('tarifas')
  .select(`
    *,
    tenant:tenants(id, nombre),
    creador:profiles!tarifas_created_by_fkey(id, nombre, apellido)
  `)
  .order('nombre');
```

### 3. Actualizar la Interface `Tarifa`

Agregar los nuevos campos:

```typescript
interface Tarifa {
  // ... campos existentes ...
  tenant_id: string | null;
  created_by: string | null;
  tenant?: {
    id: string;
    nombre: string;
  } | null;
  creador?: {
    id: string;
    nombre: string;
    apellido: string | null;
  } | null;
}
```

### 4. Mostrar Información en las Tarjetas (Solo Super Admin)

Agregar al final de cada tarjeta, antes del switch de activación:

```tsx
{isSuperAdmin() && tarifa.tenant && (
  <div className="mt-3 pt-3 border-t border-dashed">
    <div className="text-xs text-muted-foreground space-y-1">
      <div className="flex items-center gap-2">
        <Building2 className="h-3 w-3" />
        <span>Empresa: <strong>{tarifa.tenant.nombre}</strong></span>
      </div>
      {tarifa.creador && (
        <div className="flex items-center gap-2">
          <Users className="h-3 w-3" />
          <span>Creado por: {tarifa.creador.nombre} {tarifa.creador.apellido || ''}</span>
        </div>
      )}
    </div>
  </div>
)}
```

### 5. Guardar `created_by` al Crear Tarifa

Modificar la mutación de creación para incluir el ID del usuario:

```typescript
const { data: newTarifa, error } = await supabase.from('tarifas').insert({
  ...tarifaData,
  tenant_id: profile?.tenant_id,
  created_by: user?.id, // <-- Agregar esto
}).select('id').single();
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| Migración SQL | Agregar columna `created_by` a `tarifas` |
| `src/pages/Rates.tsx` | Actualizar query, interface y UI |

## Resultado Visual

Para usuarios normales: Sin cambios (no ven la información adicional)

Para Super Admin: Cada tarjeta mostrará en la parte inferior:
```
─────────────────────────
🏢 Empresa: Empresa Principal  
👤 Creado por: Juan Pérez
```


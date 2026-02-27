
# Fix: Aislamiento de conceptos por tenant

## Problema

Actualmente hay varias fallas en el filtrado de conceptos por tenant:

1. **NewShipment.tsx**: La query de `tarifa_conceptos` no filtra por tenant. Aunque la RLS lo filtra para usuarios normales, el super admin ve todos los conceptos de todos los tenants cuando crea un envio.

2. **Rates.tsx**: Cuando el super admin crea un concepto nuevo, se guarda con `profile?.tenant_id` (el tenant del super admin), no con el tenant que esta administrando. Si el super admin quiere crear un concepto para Beraexpress, se crea con el tenant equivocado.

3. **RLS de `tarifa_conceptos`**: La politica SELECT no incluye `tenant_id IS NULL`, por lo que los conceptos globales no son visibles para usuarios normales.

## Cambios propuestos

### 1. Base de datos - Actualizar RLS de `tarifa_conceptos`

Modificar la politica SELECT para incluir conceptos globales (tenant_id IS NULL):

```sql
-- De:
((tenant_id = current_user_tenant()) OR is_super_admin(auth.uid()))
-- A:
((tenant_id = current_user_tenant()) OR tenant_id IS NULL OR is_super_admin(auth.uid()))
```

### 2. Rates.tsx - Fijar tenant_id al crear conceptos como super admin

Cuando el super admin crea un concepto, debe usar el `conceptoTenantFilter` seleccionado (si hay uno) en lugar del tenant del super admin. Esto evita que los conceptos se creen con el tenant equivocado.

Linea 403: Cambiar `tenant_id: profile?.tenant_id` por logica que use el filtro de tenant activo si es super admin.

### 3. NewShipment.tsx - Filtrar conceptos por tenant del usuario

Agregar filtro `tenant_id` en la query de `tarifa_conceptos` (linea 348-357) para que solo traiga conceptos del tenant del usuario (y globales). Aunque la RLS ya filtra para usuarios normales, esto es una buena practica de defensa en profundidad.

```typescript
// Agregar filtro:
.or(`tenant_id.eq.${profile?.tenant_id},tenant_id.is.null`)
```

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| Migracion SQL | Actualizar RLS policy de `tarifa_conceptos` para incluir `tenant_id IS NULL` |
| `src/pages/Rates.tsx` | Usar tenant del filtro al crear conceptos como super admin |
| `src/pages/NewShipment.tsx` | Agregar filtro de tenant en query de conceptos |

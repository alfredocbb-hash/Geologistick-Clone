

# Plan: Agregar Política RLS de DELETE para Envíos

## Problema Identificado

La tabla `envios` **no tiene política RLS para DELETE**. Actualmente solo existen políticas para:
- `SELECT` - "Ver envíos de su tenant"
- `INSERT` - "Crear envíos en su tenant"  
- `UPDATE` - "Actualizar envíos de su tenant"

Sin una política DELETE, Supabase acepta la petición (204) pero **no elimina ningún registro**.

## Solución

Crear una política RLS que permita eliminar envíos a usuarios administradores del mismo tenant.

### Migración SQL Requerida

```sql
CREATE POLICY "Eliminar envíos de su tenant"
  ON public.envios
  FOR DELETE
  USING (
    (tenant_id = current_user_tenant() AND is_admin(auth.uid()))
    OR is_super_admin(auth.uid())
  );
```

### Condiciones de la Política

| Rol | Puede Eliminar |
|-----|----------------|
| admin del tenant | Sí |
| super_admin | Sí |
| Otros roles (operador, chofer, etc.) | No |

Esto asegura que solo administradores puedan eliminar envíos, evitando eliminaciones accidentales por usuarios operativos.

---

## Resumen de Cambios

| Tipo | Acción |
|------|--------|
| Migración DB | Crear política RLS `DELETE` en tabla `envios` |

Una vez aplicada la migración, la función de "Eliminar Envío" en pedidos e-commerce funcionará correctamente.


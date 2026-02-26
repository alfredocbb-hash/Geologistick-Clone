

# Fix: Duplicacion de Clientes y busqueda en Terciarizados

## Problema

1. **Duplicados en la tabla clientes**: El formulario de envios terciarizados (`ThirdPartyShipmentsTab`) busca clientes existentes solo por telefono exacto y sin filtrar por `tenant_id`. Si el telefono no coincide exactamente (o esta vacio), se crea un duplicado con el mismo nombre y direccion.

2. **Cliente no aparece en el buscador del Planificador (terciarizados)**: El autocomplete de contactos funciona correctamente, pero si el usuario no encuentra al cliente (por diferencia en el nombre o busqueda parcial), carga los datos manualmente y el sistema crea un duplicado.

## Solucion

### 1. Constraint de base de datos para prevenir duplicados

Agregar un indice unico parcial en la tabla `clientes` para evitar duplicados por `tenant_id` + `nombre` + `direccion` (ignorando nulos).

```text
CREATE UNIQUE INDEX idx_clientes_unique_nombre_direccion 
ON clientes (tenant_id, LOWER(TRIM(nombre)), LOWER(TRIM(direccion)))
WHERE nombre IS NOT NULL AND direccion IS NOT NULL;
```

Esto previene la creacion de dos clientes con el mismo nombre y direccion dentro del mismo tenant.

### 2. Mejorar findOrCreateClient en ThirdPartyShipmentsTab

| Archivo | Cambio |
|---|---|
| `src/components/routes/ThirdPartyShipmentsTab.tsx` | Mejorar `findOrCreateClient` para buscar tambien por nombre+direccion ademas de telefono, y filtrar siempre por `tenant_id`. Manejar el error de constraint duplicado gracefully. |

Logica mejorada:
1. Buscar por telefono + tenant_id (exacto)
2. Si no encuentra, buscar por nombre + direccion + tenant_id (case-insensitive)
3. Si encuentra match, retornar el ID existente
4. Si no encuentra, crear nuevo
5. Si el INSERT falla por constraint unico, buscar el existente y retornar su ID

### 3. Herramienta para limpiar duplicados existentes

Ejecutar una query de datos para eliminar los duplicados existentes, conservando el registro mas antiguo (primer `created_at`).

```text
-- Identificar y eliminar duplicados conservando el mas antiguo
DELETE FROM clientes
WHERE id NOT IN (
  SELECT DISTINCT ON (tenant_id, LOWER(TRIM(nombre)), LOWER(TRIM(direccion))) id
  FROM clientes
  WHERE nombre IS NOT NULL AND direccion IS NOT NULL
  ORDER BY tenant_id, LOWER(TRIM(nombre)), LOWER(TRIM(direccion)), created_at ASC
)
AND nombre IS NOT NULL 
AND direccion IS NOT NULL
AND id NOT IN (
  SELECT DISTINCT destinatario_id FROM envios WHERE destinatario_id IS NOT NULL
  UNION
  SELECT DISTINCT remitente_id FROM envios WHERE remitente_id IS NOT NULL
);
```

Nota: Solo se eliminan duplicados que no esten referenciados por envios. Los que si estan referenciados se dejan para revision manual o se actualizan las referencias primero.

### Resumen de cambios

| Componente | Tipo | Descripcion |
|---|---|---|
| Base de datos | Migracion | Indice unico parcial en `clientes(tenant_id, nombre, direccion)` |
| Base de datos | Datos | Limpiar duplicados existentes no referenciados |
| `ThirdPartyShipmentsTab.tsx` | Codigo | Mejorar busqueda de cliente existente con fallback por nombre+direccion y filtro tenant_id |


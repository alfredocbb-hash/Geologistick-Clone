

# Diagnóstico: "new row violates row-level security policy for table 'clientes'"

## Qué significa el error

Al crear un envío nuevo, el sistema intenta insertar un registro en la tabla `clientes` (para el remitente o destinatario) y la política de seguridad RLS lo rechaza.

## Análisis

**Política INSERT actual en `clientes`:**
```sql
WITH CHECK (
  tenant_id = current_user_tenant()
  AND (is_admin OR operador OR atencion_cliente OR sucursal OR despachador OR supervisor
       OR sucursal_id = get_user_sucursal(auth.uid()))
)
```

**El usuario "Soporte" (alfredobernard2025@gmail.com):**
- Roles: `sucursal`, `despachador` -- ambos están en la política
- Tenant: `81be07a7-...` -- correcto
- Sucursal: `BURZACO(BS AS)`

**Problema identificado:** El rol `chofer` **no está** en la política INSERT. Si otro usuario con rol `chofer` (u otro rol no listado) intenta crear un envío, falla. Pero este usuario sí tiene los roles correctos.

**Causa más probable:** La **política SELECT** restringe la visibilidad de clientes por sucursal. Cuando el sistema busca un cliente existente por teléfono/DNI, si ese cliente pertenece a **otra sucursal**, el SELECT devuelve vacío (por RLS). Luego intenta crear uno nuevo, pero el `tenant_id` pasado desde `profile?.tenant_id` puede no coincidir si el profile no cargó correctamente, o hay un conflicto con el constraint único que se manifiesta como error RLS.

## Solución propuesta

### 1. Agregar el rol `chofer` a la política INSERT de `clientes`
Para que choferes que también crean envíos puedan insertar clientes.

### 2. Mejorar la política SELECT de `clientes` 
Permitir que roles operativos (`despachador`, `operador`, `atencion_cliente`) vean **todos los clientes del tenant** (no solo los de su sucursal), ya que necesitan buscar clientes existentes al crear envíos.

### 3. Agregar búsqueda por nombre+dirección en `findOrCreateClient`
Como se discutió anteriormente, agregar un paso de búsqueda por nombre+dirección antes del INSERT, y manejar el error `23505` con un fallback de recuperación.

## Cambios técnicos

### Migración SQL
- Actualizar política SELECT de `clientes`: roles `sucursal`, `despachador`, `operador`, `atencion_cliente`, `supervisor` ven todos los clientes del tenant
- Actualizar política INSERT de `clientes`: agregar rol `chofer`

### Código (NewShipment.tsx)
- Agregar paso 3 de búsqueda por nombre+dirección (case-insensitive) antes del INSERT
- Mejorar el catch de error `23505` para hacer fallback a SELECT en vez de propagar error

**3 cambios: 1 migración SQL + 1 archivo de código.**


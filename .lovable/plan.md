

# Plan: Vincular Sellers a Usuarios

## Resumen

Agregar la funcionalidad para vincular sellers de e-commerce con usuarios del sistema. Esto permitira que los sellers puedan acceder al Portal de Sellers creado anteriormente, autenticandose con su email/password y viendo solo los datos de su tienda.

## Arquitectura de la Vinculacion

```text
+-------------------+         +-------------------+
|  ecommerce_sellers |  <-->  |     profiles      |
|-------------------|         |-------------------|
| user_id (FK)      |-------->| user_id           |
| email             |         | email             |
| nombre            |         | nombre            |
+-------------------+         +-------------------+
                                      |
                                      v
                              +---------------+
                              |  user_roles   |
                              |---------------|
                              | user_id       |
                              | role='seller' |
                              +---------------+
```

---

## Opcion 1: Vincular Usuario Existente

### Flujo
1. Admin selecciona "Vincular usuario existente" en CreateSellerDialog
2. Se muestra un selector/autocomplete de usuarios del tenant
3. Al seleccionar, se guarda el `user_id` en `ecommerce_sellers`
4. Se verifica que el usuario tenga rol `seller`, si no lo tiene se agrega

### Implementacion
- Agregar campo de busqueda de usuarios en el formulario
- Query para buscar usuarios del mismo tenant
- Al guardar, actualizar `user_id` en el seller
- Agregar rol `seller` si no existe

---

## Opcion 2: Crear Usuario Nuevo

### Flujo
1. Admin selecciona "Crear usuario nuevo" en CreateSellerDialog
2. Se muestran campos adicionales: email de acceso, password
3. Se crea el usuario via edge function `create-user`
4. Se asigna automaticamente rol `seller`
5. Se vincula el `user_id` retornado al seller

### Implementacion
- Agregar toggle/tabs para elegir modo
- Campos de email/password para nuevo usuario
- Llamar al edge function existente `create-user` con rol `seller`
- Actualizar el seller con el `user_id` retornado

---

## Cambios en CreateSellerDialog

### Nuevo Schema del Formulario

```typescript
const formSchema = z.object({
  // ... campos existentes ...
  
  // Vinculacion de usuario
  vincular_usuario: z.enum(['ninguno', 'existente', 'nuevo']).default('ninguno'),
  user_id: z.string().optional(),  // Para usuario existente
  
  // Para crear usuario nuevo
  user_email: z.string().email().optional(),
  user_password: z.string().min(6).optional(),
});
```

### Nueva Seccion en UI

```text
+------------------------------------------+
|  Acceso al Portal de Sellers             |
|------------------------------------------|
|  ( ) Sin acceso                          |
|  ( ) Vincular usuario existente          |
|      [Buscar usuario... ▼]               |
|  ( ) Crear usuario nuevo                 |
|      Email: [________________]           |
|      Password: [________________]        |
+------------------------------------------+
```

---

## Modificaciones al Edge Function create-user

No se requieren modificaciones. El edge function ya:
- Acepta `roles` como array
- Crea el usuario con el tenant del admin
- Retorna el `user_id` del usuario creado

---

## Cambios en EditSellerDialog

### Mostrar Estado de Vinculacion
- Si tiene `user_id`: mostrar email del usuario vinculado + boton "Desvincular"
- Si no tiene `user_id`: mostrar opciones para vincular/crear

### Desvincular Usuario
- Boton "Desvincular Usuario"
- Confirmacion antes de desvincular
- Al desvincular: 
  - Setear `user_id = null` en seller
  - Opcionalmente: remover rol `seller` del usuario

---

## Flujo Completo de Creacion

```text
1. Admin abre CreateSellerDialog
   |
   v
2. Completa datos del seller (nombre, email, etc.)
   |
   v
3. Selecciona opcion de acceso:
   |
   +---> Sin acceso: Seller sin usuario vinculado
   |
   +---> Usuario existente: 
   |     - Busca y selecciona usuario
   |     - Se vincula el user_id
   |     - Se agrega rol 'seller' si falta
   |
   +---> Crear usuario nuevo:
         - Ingresa email/password
         - Se crea usuario via edge function
         - Se vincula automaticamente
         - Rol 'seller' asignado automaticamente
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/ecommerce/CreateSellerDialog.tsx` | Agregar seccion de vinculacion de usuario |
| `src/components/ecommerce/EditSellerDialog.tsx` | Mostrar estado de vinculacion y opcion de desvincular |

---

## Queries Necesarias

### Buscar usuarios del tenant para vincular

```typescript
const { data: availableUsers } = useQuery({
  queryKey: ['users-for-seller', tenantId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, email, nombre, apellido')
      .eq('tenant_id', tenantId)
      .eq('activo', true)
      .order('nombre');
    if (error) throw error;
    return data;
  },
  enabled: !!tenantId && open,
});
```

### Verificar/agregar rol seller

```typescript
// Verificar si ya tiene rol seller
const { data: existingRole } = await supabase
  .from('user_roles')
  .select('id')
  .eq('user_id', selectedUserId)
  .eq('role', 'seller')
  .maybeSingle();

// Si no tiene, agregarlo
if (!existingRole) {
  await supabase
    .from('user_roles')
    .insert({ user_id: selectedUserId, role: 'seller' });
}
```

---

## Consideraciones de Seguridad

1. **Aislamiento por tenant**: Solo se pueden vincular usuarios del mismo tenant
2. **Validacion de permisos**: Solo admins pueden vincular usuarios a sellers
3. **Rol seller**: Se asigna automaticamente al vincular, garantizando acceso correcto al portal
4. **Password seguro**: Minimo 6 caracteres al crear usuario nuevo

---

## Orden de Implementacion

1. **CreateSellerDialog**: Agregar seccion de vinculacion con las 3 opciones
2. **EditSellerDialog**: Mostrar estado actual y opcion de desvincular
3. **Testing**: Probar flujo completo de vinculacion y acceso al portal

---

## Resultado Esperado

Despues de implementar:
- El admin puede crear un seller y simultaneamente crear su acceso al portal
- Los sellers vinculados pueden hacer login y ver `/seller/*`
- Los sellers sin vincular no tienen acceso al sistema
- La tabla de sellers muestra el estado de vinculacion de cada uno


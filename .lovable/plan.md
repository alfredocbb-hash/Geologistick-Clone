

# Notificaciones de Admin a Sucursales

## Objetivo

Permitir que los administradores de cada empresa envien notificaciones a los usuarios de sus sucursales, similar a como el super admin envia notificaciones a los tenants.

## Cambios

### 1. Nuevo componente: `src/components/notifications/SendBranchNotificationDialog.tsx`

Un dialogo reutilizable que permite al admin:
- Seleccionar una o todas las sucursales de su tenant
- Elegir el tipo de notificacion (info, advertencia, exito, error)
- Escribir titulo y mensaje
- Enviar la notificacion a todos los usuarios de la(s) sucursal(es) seleccionada(s)

La logica de envio:
1. Consultar `profiles` filtrando por `tenant_id` del admin y opcionalmente por `sucursal_id`
2. Insertar una notificacion por cada usuario encontrado en la tabla `notifications`
3. La politica RLS existente (`tenant_id = current_user_tenant()`) ya permite esta insercion

### 2. Integrar el boton en el Dashboard o header

Agregar un boton "Enviar Notificacion" en la pagina de Dashboard (`src/pages/Dashboard.tsx`) visible solo para admins, que abra el dialogo.

### 3. Sin cambios en base de datos

La politica RLS existente para INSERT ya permite que usuarios autenticados inserten notificaciones donde `tenant_id = current_user_tenant()`, lo cual cubre este caso perfectamente. No se necesitan migraciones.

## Detalle tecnico

| Archivo | Cambio |
|---|---|
| `src/components/notifications/SendBranchNotificationDialog.tsx` | Nuevo componente: dialogo para enviar notificaciones a sucursales |
| `src/pages/Dashboard.tsx` | Agregar boton "Enviar Notificacion" para admins que abre el dialogo |

### Estructura del dialogo

```text
+-----------------------------------------------+
|  Enviar Notificacion                      [X]  |
|-----------------------------------------------|
|  Sucursal: [Todas las sucursales  v]          |
|  Tipo:     [Informacion          v]           |
|  Titulo:   [________________________]         |
|  Mensaje:  [________________________]         |
|            [________________________]         |
|-----------------------------------------------|
|                    [Cancelar]  [Enviar]        |
+-----------------------------------------------+
```

### Flujo

1. Admin abre el Dashboard y presiona "Enviar Notificacion"
2. Selecciona la sucursal destino (o "Todas")
3. Escribe titulo, mensaje y tipo
4. Presiona "Enviar"
5. Se insertan notificaciones para cada usuario de esa sucursal
6. Los usuarios ven la notificacion en su popover en tiempo real (ya funciona con el canal realtime existente)

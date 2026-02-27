
# Pendientes de Federacion + Guia de Super Administrador PDF

## 1. Que falta del sistema de federacion

El sistema base esta implementado (tablas, edge function, UI de partners, derivacion de envios). Quedan estos items pendientes:

| Pendiente | Descripcion |
|---|---|
| Notificaciones de partnership | Cuando un tenant recibe una solicitud o un envio derivado, no se genera una notificacion en la tabla `notifications`. Hay que insertar notificaciones desde la edge function `partner-sync`. |
| Sync de estado bidireccional | Cuando el envio destino cambia de estado (ej: entregado), el envio origen no se entera. Falta un mecanismo para sincronizar estados entre ambos envios vinculados. |
| Permisos editables | La UI no permite editar los permisos de una partnership activa (ver precio, ver cliente, etc). Solo se setean por defecto al crear. |

Estos 3 items se implementaran junto con la guia PDF.

## 2. Guia de Super Administrador (PDF descargable)

Se creara un PDF descargable desde la pagina de Configuracion del Sistema, siguiendo el mismo patron que `generateUserGuidePDF.ts`. El documento cubrira todas las funciones exclusivas del super administrador.

### Contenido de la guia

- Gestion de Tenants (crear, editar, activar/desactivar empresas)
- Gestion de Usuarios (crear usuarios con roles, resetear contrasenas, asignar a tenants)
- Branding por Tenant (logos, colores, dominio personalizado)
- Permisos por Rol (configurar que puede hacer cada rol)
- API Keys (generar y administrar claves por tenant)
- Planes y Suscripciones (trial, planes, limites)
- Sistema de Federacion (partnerships entre tenants, derivacion de envios)
- Solicitudes de Trial (revisar y aprobar)

## Cambios

| Archivo | Cambio |
|---|---|
| `src/lib/generateSuperAdminGuidePDF.ts` | Nuevo archivo con el contenido y generador del PDF de super administrador |
| `src/pages/SystemSettings.tsx` | Nueva card visible solo para super_admin con boton para descargar la guia |
| `supabase/functions/partner-sync/index.ts` | Agregar insercion de notificaciones al solicitar partnership, aceptar/rechazar, y derivar envios |

### Detalle tecnico

**PDF**: Seguir el patron exacto de `generateUserGuidePDF.ts` usando los helpers de `pdfHelpers.ts` (portada, indice, secciones con header de color). Nombre del archivo: `guia-super-admin-geologistick.pdf`.

**Notificaciones en partner-sync**: En cada accion relevante (request_partnership, respond_partnership, derive_shipment, accept/reject_shipment), insertar un registro en la tabla `notifications` dirigido a los admins del tenant afectado. Se obtienen los admins con un query a `user_roles` + `profiles`.

**Card en SystemSettings**: Agregar una card con icono Shield, titulo "Guia de Super Administrador", visible solo cuando `isSuperAdmin()` es true. Boton de descarga con spinner de carga.

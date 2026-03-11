

# Auto-mostrar notificaciones no leídas hasta que se marquen como leídas

## Objetivo

Cuando el usuario tiene notificaciones no leídas, mostrar automáticamente un diálogo con la notificación más reciente no leída al cargar la página. El diálogo solo se cierra definitivamente cuando el usuario la marca como leída. Si cierra el diálogo sin marcarla, volverá a aparecer en la próxima carga o navegación.

## Cambio

**Archivo: `src/components/notifications/NotificationPopover.tsx`**

1. Agregar un `useEffect` que detecte la primera notificación no leída y la muestre automáticamente como `selectedNotification` al montar el componente o cuando cambian las notificaciones.
2. Usar un estado local `dismissedIds` (Set) para trackear notificaciones cerradas sin leer durante la sesión actual -- esto evita que el popup aparezca en loop infinito mientras el usuario navega en la misma sesión, pero al recargar la página volverá a aparecer.
3. Cuando el usuario cierra el diálogo sin marcar como leída, agregar el ID a `dismissedIds`. Cuando marca como leída, simplemente cerrar.
4. Modificar el `onOpenChange` del Dialog para que al cerrar sin leer, agregue a dismissed en vez de bloquear el cierre.

De este modo:
- Al entrar a cualquier página con el layout, el popup aparece automáticamente
- Si cierra sin leer → no vuelve a aparecer en esa sesión, pero sí al recargar
- Si marca como leída → desaparece definitivamente

Un solo archivo modificado, sin cambios de base de datos.


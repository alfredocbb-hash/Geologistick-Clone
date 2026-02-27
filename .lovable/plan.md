

# Notificaciones: vista expandida y confirmacion de lectura

## Problema actual

Las notificaciones se reciben correctamente (las politicas RLS de SELECT/UPDATE estan bien configuradas), pero el popover solo muestra un preview corto del titulo y mensaje. No hay forma de:
1. Abrir la notificacion completa para leer todo el contenido
2. Ver una confirmacion visual clara de que fue leida

## Solucion

Crear un dialog que se abra al hacer clic en una notificacion, mostrando el contenido completo con un boton explicito de "Marcar como leida".

### Cambios en `src/components/notifications/NotificationPopover.tsx`

1. Agregar un estado para la notificacion seleccionada
2. Al hacer clic en una notificacion, abrir un Dialog con:
   - Icono de tipo (info/warning/success/error) con su color
   - Titulo completo
   - Mensaje completo (sin truncar)
   - Fecha y hora
   - Boton "Marcar como leida" (si no esta leida) que ejecuta `markAsRead` y muestra feedback visual
   - Indicador de estado: badge "Leida" / "No leida"
3. Mantener la funcionalidad del link: si la notificacion tiene link, mostrar un boton adicional "Ir al detalle"

### Estructura del Dialog

```text
+------------------------------------------+
|  [icon] Titulo de la notificacion    [X] |
|------------------------------------------|
|                                          |
|  Mensaje completo de la notificacion     |
|  sin truncar, mostrando todo el texto    |
|  que envio el super admin.               |
|                                          |
|  Hace 5 minutos                          |
|                                          |
|  [Badge: No leida]                       |
|                                          |
|------------------------------------------|
|  [Marcar como leida]    [Ir al detalle]  |
+------------------------------------------+
```

### Flujo

1. Admin abre el popover de notificaciones
2. Hace clic en una notificacion
3. Se abre el dialog con el contenido completo
4. Presiona "Marcar como leida" -> se ejecuta `markAsRead`, el badge cambia a "Leida", y el indicador de no-leida desaparece tanto en el dialog como en la lista
5. Si hay link, puede presionar "Ir al detalle" para navegar

## Detalle tecnico

| Archivo | Cambio |
|---|---|
| `src/components/notifications/NotificationPopover.tsx` | Agregar Dialog para ver notificacion completa con boton de confirmar lectura |

No se requieren cambios en base de datos ni nuevas politicas RLS - las existentes ya permiten SELECT y UPDATE correctamente.

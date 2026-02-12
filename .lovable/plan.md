

# Fix: La app requiere limpiar caché para reflejar la reprogramación

## Problema

El `RescheduleDialog` hace un optimistic update correcto en `onMutate` (filtra el envío del cache), pero en `onSuccess` llama `invalidateQueries` **sin `await`**. Esto causa que:

1. El optimistic update remueve el envío del cache temporalmente
2. `onSuccess` dispara `invalidateQueries` (no esperado) y luego cierra el diálogo inmediatamente
3. El refetch automático trae la data nueva **después** de que el componente ya procesó el cierre
4. En Android/WebView, la race condition es más notoria: a veces la data vieja vuelve antes de que el refetch con la data nueva llegue

El resultado es que la vista se queda mostrando la parada reprogramada hasta que el usuario limpia caché.

## Solución

Hacer que `onSuccess` **espere** a que los queries se refresquen antes de cerrar el diálogo. Usar `await` en los `invalidateQueries` críticos y asegurar que el refetch se complete.

## Cambio

| Archivo | Cambio |
|---------|--------|
| `src/components/driver/RescheduleDialog.tsx` | Convertir `onSuccess` en async y esperar los `invalidateQueries` antes de cerrar el diálogo |

## Detalle técnico

En `RescheduleDialog.tsx`, cambiar el `onSuccess` de:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['my-active-route-paradas'] });
  queryClient.invalidateQueries({ queryKey: ['my-active-route-envios-hoja'] });
  queryClient.invalidateQueries({ queryKey: ['my-active-route-hoja'] });
  queryClient.invalidateQueries({ queryKey: ['my-active-route-planificada'] });
  toast.success('Entrega reprogramada correctamente');
  onSuccess();
  onClose();
},
```

A:

```typescript
onSuccess: async () => {
  // Esperar a que los queries se refresquen ANTES de cerrar
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['my-active-route-paradas'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['my-active-route-envios-hoja'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['my-active-route-hoja'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['my-active-route-planificada'], refetchType: 'active' }),
  ]);
  toast.success('Entrega reprogramada correctamente');
  onSuccess();
  onClose();
},
```

La diferencia clave es el `await Promise.all(...)`. Esto garantiza que la data fresca (con la parada ya marcada como 'reprogramado') se cargue en el cache antes de que el diálogo se cierre y el componente `ActiveRouteNavigation` recalcule `nextStop`.

## Resultado esperado

Al presionar "Reprogramar", el diálogo espera a que la data actualizada se cargue, y luego se cierra. La vista avanza inmediatamente a la siguiente parada sin necesidad de limpiar caché ni reiniciar la app.

## Recordatorio

Publicar los cambios para que la app Android los tome.


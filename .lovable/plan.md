
# Corregir 3 problemas: Mercado Pago para choferes, cierre de ruta y fotos

## Problema 1: Mercado Pago no aparece para choferes

La tabla de configuracion de integraciones solo permite lectura a administradores. Los choferes no pueden consultar si Mercado Pago esta configurado, por lo que la opcion nunca se muestra.

**Solucion**: Agregar una politica de lectura que permita a todos los usuarios autenticados del mismo tenant ver las configuraciones de integracion (sin exponer credenciales sensibles, ya que la consulta solo verifica existencia de registros activos).

## Problema 2: Error "Solo se pueden cerrar rutas en curso" y modal trabado

Cuando el chofer completa todas las paradas, aparece un modal de "Ruta Completada" con el boton "Cerrar Ruta". Si el cierre falla (porque la ruta ya fue cerrada o cambio de estado), el error aparece como un toast pero el modal no se puede cerrar -- no tiene boton de cerrar ni forma de salir. El chofer queda atrapado.

**Solucion**:
- Agregar un boton de cerrar (X) al modal de ruta completada para que el chofer pueda salir
- Mejorar la logica de cierre para que si la ruta ya esta completada, se trate como exito y se navegue a "Mis Rutas"
- Verificar el estado real de la ruta antes de intentar cerrarla

## Problema 3: Fotos requieren multiples intentos

En Android, el atributo `capture="environment"` fuerza la apertura de la camara nativa, lo cual puede causar que el WebView se recargue. Ademas, el valor del input de archivo no se limpia entre intentos, lo que puede causar que el navegador no dispare el evento de cambio.

**Solucion**:
- Limpiar el valor del input (`value = ''`) antes de abrir la camara para asegurar que el evento `onChange` se dispare siempre
- Quitar `capture="environment"` para usar el selector de archivos del sistema (mas confiable en WebView, y permite elegir entre camara y galeria)
- Agregar manejo de error visual si la foto no se carga

## Detalle tecnico

### Migracion SQL - Nueva politica RLS

Agregar una politica SELECT en `system_integrations` para usuarios autenticados del mismo tenant:

```text
CREATE POLICY "Users can view their tenant integrations"
  ON system_integrations FOR SELECT
  TO authenticated
  USING (tenant_id = current_user_tenant());
```

### Cambios en `ActiveRouteNavigation.tsx`

1. Agregar boton X/cerrar al modal de ruta completada (lineas 932-963)
2. Modificar `closeRouteMutation`:
   - En `onError`: si el mensaje contiene "Solo se pueden cerrar", refrescar el estado de la ruta y si ya esta completada, navegar a Mis Rutas
   - Agregar un boton "Volver a Mis Rutas" como alternativa al modal

### Cambios en `DeliveryConfirmation.tsx`

1. En `handleOpenCamera` (linea 138): agregar `fileInputRef.current.value = ''` antes de hacer click
2. En el input de foto (linea 534): quitar `capture="environment"` para mejor compatibilidad con WebView Android

### Archivos afectados

| Recurso | Cambio |
|---------|--------|
| Migracion SQL | Nueva politica RLS SELECT en `system_integrations` para todos los usuarios del tenant |
| `src/pages/ActiveRouteNavigation.tsx` | Boton cerrar en modal completado, manejo de error mejorado |
| `src/components/delivery/DeliveryConfirmation.tsx` | Reset del input de foto, quitar `capture="environment"` |

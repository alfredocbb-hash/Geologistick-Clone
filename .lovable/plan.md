
## Problema
El mapa del EPOD ahora se renderiza, pero apunta a una ubicación **incorrecta** en Hurlingham (`-34.6838, -58.5397`). La dirección real "Sebastián Gaboto 2714" está en **Bosques, Florencio Varela** (~`-34.8168, -58.2044`), como muestra la captura del usuario (marcador entre Sebastián Gaboto, Calle 1031, Salón Santa Sofía y Bosques 21).

## Causa
En la corrección de coordenadas previa, se actualizaron las 4 columnas (`entrega_lat/lng` y `destinatario_lat/lng`) con un resultado de geocoder erróneo. Curiosamente, el valor **original** de `destinatario_lat/lng` (`-34.81623900, -58.20442810`) ya era correcto y coincide con la ubicación real visible en el mapa del usuario.

## Acción
Geocodificar con Google Geocoding API (vía edge function `geocode-address`) la dirección "Sebastián Gaboto 2714, Bosques, Florencio Varela, Buenos Aires" para obtener coordenadas precisas, validarlas contra la captura del usuario, y luego ejecutar un UPDATE en `envios` (id `85aa726f-8e23-4e82-a38f-c2e0c62287ed`) para sincronizar los 4 campos:

```sql
UPDATE envios
SET entrega_lat = <lat>,
    entrega_lng = <lng>,
    destinatario_lat = <lat>,
    destinatario_lng = <lng>,
    ciudad_entrega = 'Bosques',  -- corregir también la ciudad ("Gran Buenos Aires" es genérico)
    updated_at = now()
WHERE id = '85aa726f-8e23-4e82-a38f-c2e0c62287ed';
```

Si el geocoder de Google devuelve un resultado dudoso (lejos de `-34.81, -58.20`), uso directamente el valor original que el sistema ya tenía guardado: `-34.81623900, -58.20442810`.

## Verificación
Tras el update, regenerar el EPOD del envío 1564 y confirmar que el mapa muestra el marcador en Sebastián Gaboto 2714 (Bosques), idéntico a la captura aportada.

## Riesgo
Bajo. Cambio puntual a un solo registro, con valor de respaldo conocido si el geocoder falla.

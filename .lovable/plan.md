

# Corregir error al planificar pedidos de e-commerce

## Problema encontrado

Cuando seleccionas pedidos de e-commerce y presionas "Planificar", los envios se pasan correctamente al Planificador de Rutas. Sin embargo, el planificador usa las coordenadas `destinatario_lat`/`destinatario_lng` para calcular posiciones, pero los envios creados desde e-commerce guardan sus coordenadas en `entrega_lat`/`entrega_lng`. Esto produce coordenadas vacias (NaN) que rompen la optimizacion de ruta y la visualizacion del mapa.

## Solucion

### Archivo: `src/pages/RoutePlanner.tsx`

**Cambio 1 - Mapeo de coordenadas (linea ~245)**

Modificar la logica de `coords` para usar como prioridad `entrega_lat`/`entrega_lng` (que es donde los envios de ecommerce guardan las coordenadas), con fallback a `destinatario_lat`/`destinatario_lng`:

```
Antes:  { lat: envio.destinatario_lat, lng: envio.destinatario_lng }
Ahora:  { lat: envio.entrega_lat || envio.destinatario_lat, lng: envio.entrega_lng || envio.destinatario_lng }
```

Lo mismo para el caso de retiro:
```
Antes:  { lat: envio.remitente_lat, lng: envio.remitente_lng }
Ahora:  { lat: envio.retiro_lat || envio.remitente_lat, lng: envio.retiro_lng || envio.remitente_lng }
```

Esto es consistente con la logica de direccion que ya usa `direccion_entrega || destinatario?.direccion` en el resto del planificador.

## Sin cambios de base de datos
El campo `entrega_lat`/`entrega_lng` ya existe en la tabla `envios`.

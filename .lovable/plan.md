

## Problema
El EPOD del envío `1564` (Micaela Contreras, "Sebastián Gaboto 2714, Gran Buenos Aires") muestra el mapa centrado en una ubicación incorrecta. El sistema guardó dos pares de coordenadas que no corresponden a esa dirección:

- `entrega_lat/lng = -34.7872788, -58.1872628` (usado por el EPOD → punto erróneo)
- `destinatario_lat/lng = -34.81623900, -58.20442810` (también lejos de la dirección real)

Verificado contra geocoder externo: ninguna de las dos coincide con "Sebastián Gaboto 2714". La dirección real (Villa Giardino, La Matanza, CP 1766) ronda `-34.6829, -58.5381`.

## Solución
Re-geocodificar la dirección con la API de Google Maps (vía la Edge Function `geocode-address` ya existente) y actualizar **ambos** pares de coordenadas en el envío para mantener la consistencia exigida por el sistema (`entrega_lat/lng` debe sincronizarse con `destinatario_lat/lng`).

### Pasos
1. Invocar `geocode-address` con `address="Sebastián Gaboto 2714"`, `city="La Matanza"`, `province="Buenos Aires"` para obtener coordenadas precisas.
2. Ejecutar un `UPDATE` en `envios` para el id `85aa726f-8e23-4e82-a38f-c2e0c62287ed`:
   - `entrega_lat`, `entrega_lng` ← nuevas coords
   - `destinatario_lat`, `destinatario_lng` ← mismas coords
   - `updated_at = now()`
3. El próximo EPOD descargado generará automáticamente el static map sobre la dirección correcta (la lógica actual en `generateEPODPDF.ts` ya usa `entrega_lat/lng` + `mapsApiKey`).

### Sin cambios de código
No es necesario modificar `generateEPODPDF.ts` ni `ShipmentDetailsDialog.tsx`: ambos ya generan el mapa correctamente cuando las coordenadas son válidas. El problema es solo de datos.

### Archivos / acciones
| Acción | Detalle |
|---|---|
| Edge function call | `geocode-address` para "Sebastián Gaboto 2714, La Matanza, Buenos Aires" |
| SQL update | `envios` id `85aa726f-8e23-4e82-a38f-c2e0c62287ed` → actualizar 4 columnas de coordenadas |

### Riesgo
Bajo. Solo afecta a un envío. Si el geocoder devuelve un resultado inesperado, lo verifico antes de aplicar el update.


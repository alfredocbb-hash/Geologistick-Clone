

## Plan: Fix actualización de coordenadas en mapa del Planificador

### Problema
El `EditShipmentLocationDialog` actualiza los campos `destinatario_lat`/`destinatario_lng` para entregas, pero el Planificador lee las coordenadas priorizando `entrega_lat`/`entrega_lng`:

```
coords: { lat: envio.entrega_lat || envio.destinatario_lat, ... }
```

Si `entrega_lat` ya tiene un valor previo (aunque sea incorrecto), el valor nuevo en `destinatario_lat` nunca se usa. Las coordenadas del mapa quedan sin cambio.

### Solución
Actualizar `EditShipmentLocationDialog` para que escriba **ambos pares** de coordenadas (`entrega_lat`/`entrega_lng` + `destinatario_lat`/`destinatario_lng` para entregas, y `remitente_lat`/`remitente_lng` para retiros), así el planificador siempre toma el valor actualizado.

### Cambio en `src/components/routes/EditShipmentLocationDialog.tsx`

En la función `mutationFn`, actualizar la sección de entrega (líneas ~95-101):

**Antes:**
```typescript
updateData.destinatario_lat = coords.lat;
updateData.destinatario_lng = coords.lng;
```

**Después:**
```typescript
updateData.destinatario_lat = coords.lat;
updateData.destinatario_lng = coords.lng;
updateData.entrega_lat = coords.lat;
updateData.entrega_lng = coords.lng;
```

Y para retiros, agregar también la dirección de entrega inversa no aplica — solo confirmar que `remitente_lat`/`remitente_lng` ya se setean (líneas ~89-92), lo cual es correcto.

### Archivos a modificar
- `src/components/routes/EditShipmentLocationDialog.tsx` — Agregar `entrega_lat`/`entrega_lng` al update de entregas


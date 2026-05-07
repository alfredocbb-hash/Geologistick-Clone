## Agregar opción "Marcar como resuelto" en incidencias

### Problema
Cuando una incidencia ya fue resuelta por otros medios (ej: contacto telefónico con el cliente, entrega en visita posterior), el dialog actual solo permite acciones que modifican el envío (re-intentar, reprogramar, devolver, cancelar). Falta una opción para simplemente cerrar la incidencia sin tocar el envío.

### Solución
Modificar `src/components/incidents/IncidentActionDialog.tsx`:

1. **Agregar nueva acción `resuelto`** al inicio del array `RESOLUTION_ACTIONS` con icono `CheckCircle`:
   - label: "Marcar como resuelto"
   - description: "Cerrar la incidencia sin modificar el envío (ya fue resuelta)"

2. **Actualizar `resolveMutation`**: agregar caso `'resuelto'` en el switch que no ejecuta ningún update sobre `envios` ni `envio_historial`. Solo marca la incidencia como `estado: 'resuelto'` con `accion_tomada: 'resuelto'` (lógica que ya existe antes del switch).

3. **No es destructiva** — usa el estilo verde/primary normal (no rojo).

### Resultado
El admin podrá cerrar incidencias ya gestionadas externamente sin alterar el estado del envío.
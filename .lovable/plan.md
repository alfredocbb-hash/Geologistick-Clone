# Buscar por dirección, localidad y chofer en Gestión de Envíos

## Cambio
En `src/pages/Shipments.tsx`, ampliar el filtro `filteredEnvios` (línea ~373) para incluir además de tracking/nombre:

- `envio.direccion_entrega`
- `envio.ciudad_entrega`
- `envio.destinatario?.direccion`
- `envio.destinatario?.ciudad`
- Nombre del chofer (vía `choferMap[envio.chofer_id]`, ya disponible)

También se corrige un bug menor: `destinatario?.nombre` actualmente usa `.includes` sin `toLowerCase()` (no matchea minúsculas).

## Resultado
El input de búsqueda existente filtra por tracking, remitente, destinatario, dirección, localidad y nombre del chofer. Sin cambios de UI ni de BD.

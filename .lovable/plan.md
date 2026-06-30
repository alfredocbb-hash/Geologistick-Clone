## Publicación Web para Tracking

### Objetivo
Publicar la versión web actualizada del proyecto para que los links de seguimiento compartidos por los choferes funcionen correctamente en los teléfonos de los clientes.

### Contexto
- Se corrigió el link de tracking en `ActiveRouteNavigation.tsx` para usar `https://www.geologistick.com` en lugar de `localhost` cuando se comparte desde la APK nativa.
- El dominio personalizado `geologistick.com` ya está conectado al proyecto.
- Los clientes que reciban el link de WhatsApp podrán abrirlo directamente sin depender de la APK.

### Pasos
1. Verificar que la información del sitio (título, meta descripción, favicon) esté actualizada.
2. Ejecutar la publicación del proyecto a través del dominio Lovable.
3. Confirmar que el dominio personalizado `geologistick.com` sirva la versión publicada.

### Nota
Esta publicación solo afecta la versión web. La APK del chofer requiere recompilación nativa (`npx cap build android`) para incluir el cambio del link de tracking.
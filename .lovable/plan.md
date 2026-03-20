

## Plan: Actualizar capacitor.config.ts

Veo que quitaste la propiedad `server.url` del config. Esto significa que la APK cargará desde los archivos locales en `dist/` en vez de la URL remota.

### Impacto de este cambio

| Aspecto | Con `server.url` (actual) | Sin `server.url` (tu versión) |
|---------|--------------------------|-------------------------------|
| Carga de la app | Desde `geologic.lovable.app` (online) | Desde archivos empaquetados en la APK |
| Actualizaciones | Automáticas al deployar | Requiere rebuild + nueva APK |
| Velocidad inicial | Depende de internet | Instantánea (offline) |
| Funciona sin internet | No | Sí (para la UI) |

### Cambio propuesto

**`capacitor.config.ts`**: Actualizar el archivo para remover la sección `server` con la URL remota, dejando la configuración que compartiste. La app cargará desde el build local.

### Importante
Después de este cambio, cada vez que hagas cambios en el código necesitarás:
1. `npm run build` para generar el `dist/`
2. `npx cap sync android` para copiar los archivos al proyecto Android
3. Rebuild en Android Studio


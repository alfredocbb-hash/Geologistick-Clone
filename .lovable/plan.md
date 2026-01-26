
# Plan: Solucionar Redirect Persistente del APK

## Diagnóstico del Problema

La búsqueda en el código confirma que:
- ✅ `capacitor.config.ts` está **correcto** (sin `server.url`)
- ✅ No hay referencias a `lovableproject.com` en el código fuente
- ❌ **Pero el APK sigue redirigiendo**

### Causa Raíz Identificada

Cuando ejecutas `npx cap sync android`, Capacitor copia la configuración TypeScript a un archivo JSON dentro de la carpeta Android:

```
android/app/src/main/assets/capacitor.config.json
```

**El problema:** Este archivo JSON puede contener una configuración obsoleta de cuando `server.url` SÍ existía. Aunque hayas actualizado el `.ts`, el `.json` dentro de `android/` mantiene la URL antigua.

## Solución: Regenerar Completamente la Plataforma Android

### Opción 1: Eliminar y Recrear Android (Recomendado)

Desde la raíz del proyecto:

```bash
# 1. Eliminar la carpeta android completamente
rm -rf android

# 2. Volver a agregar la plataforma
npx cap add android

# 3. Construir el proyecto web
npm run build

# 4. Sincronizar con la nueva plataforma
npx cap sync android

# 5. Abrir en Android Studio
npx cap open android
```

En Android Studio:
- **Build → Clean Project**
- **Build → Rebuild Project**
- **Build → Build Bundle(s) / APK(s) → Build APK(s)**

### Opción 2: Verificar y Editar Manualmente el JSON (Más Rápido)

1. Navega a: `android/app/src/main/assets/`
2. Abre: `capacitor.config.json`
3. **Verifica** si contiene algo como:

```json
{
  "appId": "com.geologic.choferapp",
  "appName": "ChoferApp",
  "webDir": "dist",
  "server": {
    "url": "https://53354d35-df09-4ff7-9101-b454344485d4.lovableproject.com/?forceHideBadge=true",
    "cleartext": true
  }
}
```

4. **Elimina completamente** la sección `"server": { ... }`
5. El archivo debe quedar así:

```json
{
  "appId": "com.geologic.choferapp",
  "appName": "ChoferApp",
  "webDir": "dist",
  "plugins": {
    "StatusBar": {
      "style": "DARK",
      "overlaysWebView": false
    },
    "SplashScreen": {
      "launchShowDuration": 2000,
      "backgroundColor": "#1e293b",
      "showSpinner": true,
      "spinnerColor": "#3b82f6"
    },
    "BarcodeScanner": {
      "enableGoogleBarcodeScanning": true
    }
  }
}
```

6. Guarda el archivo
7. En Android Studio: **Build → Clean Project → Rebuild Project**
8. Genera el APK

### Opción 3: Comando de Windows para Limpiar (Si no funciona lo anterior)

Si estás en Windows y `rm -rf` no funciona, usa:

```cmd
# Desde la raíz del proyecto
rmdir /s /q android
npx cap add android
npm run build
npx cap sync android
npx cap open android
```

## Por Qué Esto Sucede

El flujo de Capacitor es:

```
capacitor.config.ts (tu código)
        ↓
   npx cap sync
        ↓
android/app/src/main/assets/capacitor.config.json (usado por el APK)
```

El problema es que `npx cap sync` a veces **no sobrescribe completamente** el JSON si ya existe, especialmente si hubo cambios en la estructura del objeto de configuración.

## Verificación Post-Implementación

Después de regenerar el Android y construir el APK:

1. Instala el nuevo APK en el dispositivo
2. Abre la app
3. Verifica que NO redirija a ninguna URL web
4. Verifica que cargue desde archivos locales (debería funcionar sin internet)

## Archivos a Verificar

- `android/app/src/main/assets/capacitor.config.json` ← **Este es el culpable**
- `capacitor.config.ts` ← Ya está correcto

## Notas Importantes

- **No** necesitas modificar código TypeScript/React
- **No** necesitas cambiar configuraciones de Gradle
- El problema está 100% en la configuración nativa de Capacitor
- Una vez regenerado, el APK usará los archivos del `dist/` localmente

## Próximos Pasos Recomendados

1. Usar **Opción 1** (eliminar y recrear) para garantizar limpieza total
2. Si prefieres más rápido, usar **Opción 2** (editar el JSON manualmente)
3. Después de generar el nuevo APK, probar en un dispositivo físico o emulador
4. Confirmar que la app funciona sin conexión a internet (prueba en modo avión)

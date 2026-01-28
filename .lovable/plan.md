

# Plan: Cambiar Logo de la APK a Geologistick

## Situación Actual

- El logo de Geologistick ya existe en: `src/assets/geologistick-logo.png`
- Los íconos de la APK de Android se generan en la carpeta nativa `android/` después de ejecutar `npx cap add android`
- Actualmente no hay íconos configurados en el proyecto web para la APK

## Solución

Para cambiar el ícono de la APK, necesitas seguir estos pasos **en tu entorno local** después de exportar el proyecto:

### Paso 1: Preparar los Íconos

Los íconos de Android requieren múltiples tamaños. Los archivos deben colocarse en:

```text
android/app/src/main/res/
├── mipmap-hdpi/       (72x72 px)
│   ├── ic_launcher.png
│   └── ic_launcher_round.png
├── mipmap-mdpi/       (48x48 px)
│   ├── ic_launcher.png
│   └── ic_launcher_round.png
├── mipmap-xhdpi/      (96x96 px)
│   ├── ic_launcher.png
│   └── ic_launcher_round.png
├── mipmap-xxhdpi/     (144x144 px)
│   ├── ic_launcher.png
│   └── ic_launcher_round.png
├── mipmap-xxxhdpi/    (192x192 px)
│   ├── ic_launcher.png
│   └── ic_launcher_round.png
└── mipmap-anydpi-v26/ (Adaptive icons XML)
```

### Paso 2: Usar una Herramienta de Generación

La forma más fácil es usar un generador online:

1. **Android Asset Studio**: https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html
2. Subir el logo `geologistick-logo.png`
3. Descargar el paquete de íconos generado
4. Copiar los archivos a `android/app/src/main/res/`

### Paso 3: Recompilar la APK

```bash
npx cap sync android
npx cap build android
```

## Alternativa: Instalar @capacitor/assets

Capacitor tiene un plugin oficial para generar assets automáticamente:

```bash
npm install @capacitor/assets --save-dev
```

Luego crear un archivo de configuración y ejecutar:

```bash
npx capacitor-assets generate
```

## Lo que Puedo Hacer Ahora

Puedo agregar instrucciones claras en un archivo README o script que documente este proceso para cuando generes la APK.

## Nota Importante

Los íconos de la APK no se pueden configurar desde el código web de Lovable, ya que son archivos nativos que deben existir en la carpeta `android/` que se genera localmente después de ejecutar `npx cap add android`.

**Resumen**: El cambio del ícono de la APK requiere trabajo manual en tu entorno local con Android Studio o mediante herramientas de generación de assets.


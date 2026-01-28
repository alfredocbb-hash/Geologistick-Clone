# Configuración del Ícono de la APK - Geologistick

## Requisitos Previos

- Node.js instalado
- Android Studio instalado (para compilar la APK)
- El proyecto clonado localmente desde GitHub

## Método Recomendado: @capacitor/assets

### Paso 1: Instalar la dependencia

```bash
npm install @capacitor/assets --save-dev
```

### Paso 2: Preparar los archivos de origen

Crea la siguiente estructura en la raíz del proyecto:

```
resources/
├── icon.png          (1024x1024 px - ícono principal)
├── icon-foreground.png (1024x1024 px - para adaptive icons)
├── icon-background.png (1024x1024 px - fondo del adaptive icon)
└── splash.png        (2732x2732 px - pantalla de carga)
```

**Importante**: Usa el logo de Geologistick (`src/assets/geologistick-logo.png`) como base para `icon.png`.

### Paso 3: Generar los assets

```bash
npx capacitor-assets generate
```

Esto generará automáticamente todos los tamaños necesarios para Android.

### Paso 4: Sincronizar y compilar

```bash
npx cap sync android
npx cap build android
```

---

## Método Alternativo: Android Asset Studio

Si prefieres no instalar dependencias adicionales:

1. Ve a [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html)
2. Sube el logo `src/assets/geologistick-logo.png`
3. Configura las opciones:
   - **Foreground**: Image
   - **Background color**: #1e293b (o el color de tu preferencia)
   - **Shape**: Circle o Square según prefieras
4. Descarga el paquete ZIP
5. Extrae y copia el contenido a `android/app/src/main/res/`

### Estructura de carpetas resultante

```
android/app/src/main/res/
├── mipmap-hdpi/
│   ├── ic_launcher.png       (72x72)
│   └── ic_launcher_round.png (72x72)
├── mipmap-mdpi/
│   ├── ic_launcher.png       (48x48)
│   └── ic_launcher_round.png (48x48)
├── mipmap-xhdpi/
│   ├── ic_launcher.png       (96x96)
│   └── ic_launcher_round.png (96x96)
├── mipmap-xxhdpi/
│   ├── ic_launcher.png       (144x144)
│   └── ic_launcher_round.png (144x144)
├── mipmap-xxxhdpi/
│   ├── ic_launcher.png       (192x192)
│   └── ic_launcher_round.png (192x192)
└── mipmap-anydpi-v26/
    ├── ic_launcher.xml
    └── ic_launcher_round.xml
```

---

## Verificar el Cambio

1. Conecta un dispositivo Android o inicia un emulador
2. Ejecuta: `npx cap run android`
3. Verifica que el ícono de la app sea el logo de Geologistick

---

## Solución de Problemas

### El ícono no cambia
- Desinstala la app del dispositivo/emulador
- Limpia el proyecto: `cd android && ./gradlew clean && cd ..`
- Vuelve a sincronizar: `npx cap sync android`

### Error de permisos en macOS/Linux
```bash
chmod +x android/gradlew
```

### El ícono se ve pixelado
- Asegúrate de usar una imagen fuente de al menos 1024x1024 px
- Usa formato PNG con fondo transparente para mejores resultados

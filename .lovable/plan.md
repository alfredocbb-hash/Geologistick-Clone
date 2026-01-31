

# Plan: Preparar APK con Ícono de Geologistick para Play Store

## Resumen

Preparar la aplicación ChoferApp para publicación en Google Play Store, incluyendo:
- Configurar el ícono del launcher con el logo de Geologistick
- Eliminar el hot-reload para producción
- Generar APK/AAB firmado para subir a Play Store

---

## Configuración Actual

| Parámetro | Valor Actual |
|-----------|--------------|
| App ID | `com.geologic.choferapp` |
| App Name | `ChoferApp` |
| Modo | Hot-reload (desarrollo) |

---

## Pasos a Seguir (En tu computadora local)

### Paso 1: Clonar y preparar el proyecto

```bash
# Clonar desde GitHub (si aún no lo tienes)
git clone [tu-repositorio]
cd [nombre-proyecto]

# Instalar dependencias
npm install

# Agregar plataforma Android si no existe
npx cap add android
```

### Paso 2: Instalar herramienta de assets

```bash
npm install @capacitor/assets --save-dev
```

### Paso 3: Crear carpeta de recursos

Crea la carpeta `resources/` en la raíz del proyecto con estos archivos:

```text
resources/
├── icon.png              (1024x1024 px)
├── icon-foreground.png   (1024x1024 px)  
├── icon-background.png   (1024x1024 px - color sólido #1e293b)
└── splash.png            (2732x2732 px)
```

Para crear estos archivos:

1. **icon.png**: Usa el logo de `src/assets/geologistick-logo.png` redimensionado a 1024x1024px
2. **icon-foreground.png**: El mismo logo centrado con margen (para adaptive icons de Android)
3. **icon-background.png**: Imagen de 1024x1024px con color sólido `#1e293b` (azul oscuro)
4. **splash.png**: Logo centrado sobre fondo `#1e293b` en 2732x2732px

### Paso 4: Generar todos los tamaños de íconos

```bash
npx capacitor-assets generate
```

Esto creará automáticamente todos los tamaños necesarios en `android/app/src/main/res/`.

### Paso 5: Configurar para producción (sin hot-reload)

Edita `capacitor.config.ts` y **elimina** la sección `server` si existe:

```typescript
// ELIMINAR estas líneas para producción:
// server: {
//   url: "https://...",
//   cleartext: true
// },
```

El archivo final debe quedar:

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.geologic.choferapp',
  appName: 'ChoferApp',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      style: 'DARK',
      overlaysWebView: false
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1e293b',
      showSpinner: true,
      spinnerColor: '#3b82f6'
    },
    BarcodeScanner: {
      enableGoogleBarcodeScanning: true
    }
  }
};

export default config;
```

### Paso 6: Compilar y sincronizar

```bash
# Compilar el proyecto web
npm run build

# Sincronizar con Android
npx cap sync android
```

### Paso 7: Generar APK/AAB firmado

Abre Android Studio:

```bash
npx cap open android
```

En Android Studio:
1. Menú **Build** > **Generate Signed Bundle / APK**
2. Selecciona **Android App Bundle** (recomendado para Play Store) o **APK**
3. Crea o usa un **keystore existente** (guárdalo bien, lo necesitas para futuras actualizaciones)
4. Completa los datos de firma
5. Selecciona **release** como build variant
6. Click en **Finish**

El archivo `.aab` o `.apk` se generará en:
```
android/app/release/app-release.aab
```

---

## Requisitos para Play Store

Antes de subir a Play Store, asegúrate de tener:

| Requisito | Descripción |
|-----------|-------------|
| Cuenta de desarrollador | Registro en Google Play Console ($25 USD único) |
| Ícono de la app | 512x512 PNG (se genera automáticamente) |
| Feature graphic | 1024x500 PNG (imagen promocional) |
| Capturas de pantalla | Mínimo 2 capturas por tipo de dispositivo |
| Descripción | Texto de la app (corta y larga) |
| Política de privacidad | URL a tu política de privacidad |
| Clasificación de contenido | Completar cuestionario de clasificación |

---

## Solución de Problemas

### El ícono no cambia
```bash
cd android
./gradlew clean
cd ..
npx cap sync android
```

### Error de permisos (Mac/Linux)
```bash
chmod +x android/gradlew
```

### El APK es muy grande
Usa **Android App Bundle** (.aab) en lugar de APK - Google Play optimizará automáticamente el tamaño para cada dispositivo.

---

## Resumen de Comandos

```bash
# Preparación completa
npm install
npm install @capacitor/assets --save-dev
npx cap add android

# Crear recursos en carpeta resources/ manualmente

# Generar íconos
npx capacitor-assets generate

# Compilar para producción
npm run build
npx cap sync android

# Abrir en Android Studio para firmar
npx cap open android
```


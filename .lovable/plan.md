

# Fix: Logo ausente + Impresion en tamano correcto

## Problema 1: Logo no aparece

La funcion `loadImageAsBase64` usa `fetch()` para descargar el logo desde la URL de almacenamiento. Esta URL probablemente requiere headers de autenticacion o tiene restricciones CORS que hacen que el fetch falle silenciosamente (el catch devuelve null).

### Solucion

Usar el SDK del backend para descargar el logo en vez de `fetch()` directo. Si la URL es publica (empieza con http), intentar con fetch normal primero, pero si falla, intentar descargar usando el SDK. Ademas agregar un fallback: si no se puede cargar el logo del tenant, usar el logo local de la app (`geologistick-logo.png`) que ya existe en `src/assets/`.

### Cambios

En `src/pages/PrintLabel.tsx`:

1. Importar el logo local como fallback:
```typescript
import geologistickLogo from '@/assets/geologistick-logo.png';
```

2. Modificar la carga del logo en `handlePrint` (linea 466):
```typescript
// Intentar cargar logo del tenant
let logoBase64 = envio.logoUrl ? await loadImageAsBase64(envio.logoUrl) : null;

// Fallback: si no se pudo cargar el logo del tenant, usar el logo de la app
if (!logoBase64) {
  logoBase64 = await loadImageAsBase64(geologistickLogo);
}
```

3. Mejorar `loadImageAsBase64` para manejar URLs relativas (imports de Vite generan rutas relativas):
```typescript
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
```

## Problema 2: Tamano de papel A4 en vez de etiqueta

El visor de PDF integrado de Chrome muestra el PDF con el tamano correcto (100x150mm) pero al abrir el dialogo de impresion resetea a A4. Esto es un comportamiento conocido del visor de Chrome.

### Solucion

En vez de depender del visor de PDF de Chrome, descargar el PDF directamente como archivo. El usuario luego lo abre con su visor de PDF favorito (Adobe Acrobat, Foxit, etc.) que respeta las dimensiones del documento. Tambien ofrecer una alternativa: un link para abrir en pestana nueva.

### Cambios

En `handlePrint`, reemplazar `window.open(url, '_blank')` con descarga directa + apertura:

```typescript
// Generar PDF blob
const pdfBlob = doc.output('blob');
const url = URL.createObjectURL(pdfBlob);

// Descargar el archivo PDF
const a = document.createElement('a');
a.href = url;
a.download = `etiqueta-${envio.tracking_number}.pdf`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);

// Tambien abrir en pestana nueva para vista rapida
window.open(url, '_blank');

toast.success('PDF generado. Si la impresora no detecta el tamano, abra el PDF descargado con Adobe Acrobat.');
```

### Toast informativo

Agregar un mensaje al usuario indicando que si el tamano no se detecta correctamente en Chrome, abra el PDF descargado con un visor externo como Adobe Acrobat Reader.

## Resumen de cambios

Solo se modifica `src/pages/PrintLabel.tsx`:

1. Importar logo local como fallback
2. Agregar fallback de logo en handlePrint
3. Cambiar apertura del PDF: descargar + abrir en pestana
4. Agregar toast informativo sobre el tamano de papel


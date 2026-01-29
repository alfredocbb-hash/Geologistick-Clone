
# Plan: Agregar Logo de Empresa en Comprobante PDF

## Diagnóstico

El logo del tenant no se muestra en el PDF porque:
1. La función `loadImageAsBase64()` hace `fetch()` a la URL del logo en Supabase Storage
2. Si hay problemas de CORS o la respuesta no es una imagen válida, la función retorna `null` silenciosamente
3. El fallback usa el logo de Geologistick, pero solo si existe

## Solución

### Mejoras en la carga de imágenes

| Archivo | Cambio |
|---------|--------|
| `src/lib/generateShipmentReceiptPDF.ts` | Mejorar manejo de carga de logo con detección del tipo de imagen |

### Cambios técnicos

1. **Detectar formato de imagen automáticamente** (PNG, JPG, etc.) al cargar desde URL
2. **Agregar un timeout** para evitar bloqueos largos si el servidor no responde
3. **Usar proxy/crossOrigin** si es necesario para URLs de storage
4. **Aumentar el tamaño del logo** de 12mm a 18mm para mejor visibilidad

### Código modificado

```typescript
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    // Usar Image para cargar con CORS habilitado
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  } catch {
    return null;
  }
}
```

### Ajuste de layout

En `drawReceipt`:
- Logo: de 12x12mm a **18x18mm** (más visible)
- Ajustar posición del nombre de empresa para no solapar

## Resultado esperado

El comprobante mostrará:
- **Logo del tenant** (si está configurado en branding)
- O **logo de Geologistick** como fallback si no hay logo personalizado

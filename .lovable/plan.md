

# Fix: Caché del navegador impide navegación a etiqueta

## Diagnóstico

El problema es que el navegador de la otra computadora cachea el archivo `index.html`. Cuando se navega a `/print-label`, el HTML cacheado referencia chunks JS viejos que pueden no tener las últimas rutas o componentes, causando que la página no se renderice correctamente. Con Ctrl+Shift+R se fuerza la descarga del HTML fresco y funciona.

No hay service worker en el proyecto, así que el problema es puramente caché HTTP del `index.html`.

## Solución

Agregar meta tags de no-cache al `index.html` para que los navegadores siempre revaliden el archivo HTML (los assets JS/CSS con hash de Vite seguirán siendo cacheados eficientemente):

```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
```

Esto se agrega en el `<head>` de `index.html`. Los navegadores siempre pedirán el HTML fresco al servidor, pero los archivos `.js` y `.css` (que tienen hash en el nombre) se seguirán sirviendo desde caché normalmente. Es el patrón estándar para SPAs con Vite.

### Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `index.html` | Agregar meta tags de cache-control en el `<head>` |


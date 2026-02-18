
# Corrección: Logo distorsionado y líneas solapadas en PDF de liquidaciones

## Diagnóstico de los problemas

### Problema 1: Logo distorsionado
En `drawHeader()` (línea 126), el logo se inserta con dimensiones fijas `22 x 22`:
```typescript
doc.addImage(logoBase64, 'PNG', 10, 3, 22, 22);
```
Si el logo del tenant es rectangular (por ejemplo 200x80 píxeles), se fuerza a un cuadrado de 22x22 aplastándolo. Se necesita calcular las dimensiones proporcionalmente para que siempre quepan dentro de un bounding box de `22mm` de alto manteniendo el aspect ratio.

### Problema 2: Texto solapado con el header
El header bar tiene `28mm` de alto. Dentro del header:
- Nombre empresa: `y = 12`
- Tipo de liquidación: `y = 20`
- Período: `y = 20`

El contenido del cuerpo arranca en `y = 35` (solo 7mm después del header). Con font size 9, el texto del cuerpo puede quedar casi pegado al borde inferior del header, y en páginas adicionales el problema se repite porque se llama `drawHeader()` pero luego `y = 35` para el contenido.

Adicionalmente, los `doc.rect()` del fondo alternado de filas y del cuadro financiero a veces se solapan con el borde del header en la primera página.

### Problema 3: Columnas desbordadas en seller
Para tipo `seller`, `colMonto = 172` y el pageWidth es `210mm`. Con `pageWidth - 10 = 200`, el texto de montos como `$ 51.229,95` a partir de `x = 172` con `align: 'left'` puede salirse de la página o solaparse con el borde.

## Solución

### Fix 1: Logo con aspect ratio correcto

Calcular el ancho del logo proporcionalmente a su alto (máximo 22mm de alto, máximo 40mm de ancho):

```typescript
const drawHeader = () => {
  // ...
  if (logoBase64) {
    try {
      // Crear imagen temporal para obtener dimensiones
      const imgProps = doc.getImageProperties(logoBase64);
      const maxH = 22;
      const maxW = 40;
      const ratio = imgProps.width / imgProps.height;
      let logoW = maxH * ratio;
      let logoH = maxH;
      if (logoW > maxW) {
        logoW = maxW;
        logoH = maxW / ratio;
      }
      // Centrar verticalmente en el header
      const logoY = (headerH - logoH) / 2;
      doc.addImage(logoBase64, 'PNG', 10, logoY, logoW, logoH);
      logoEndX = 10 + logoW + 4; // margen después del logo
    } catch { /* sin logo */ }
  }
};
```

### Fix 2: Espaciado correcto del header y el cuerpo

Ajustar el header a `32mm` de alto para que haya más espacio, y arrancar el contenido del cuerpo en `y = 38` (6mm después del header). Alinear verticalmente el texto del header:
- Nombre empresa: `headerH / 2 - 4` (tercio superior)
- Subtítulo y período: `headerH / 2 + 4` (tercio inferior)

### Fix 3: Columnas de la tabla rediseñadas

Rediseñar las posiciones de columna para que todo quepan bien en `210mm` con márgenes de `10mm`:
- Área útil: `10mm` a `200mm` = `190mm`

Para seller (5 columnas: Tracking, Fecha, Destinatario, Estado, Monto):
```
Tracking:     x=12,  ancho≈45mm  (substring 18 chars)
Fecha:        x=60,  ancho≈20mm
Destinatario: x=83,  ancho≈50mm  (substring 20 chars)
Estado:       x=136, ancho≈30mm  (substring 12 chars)
Monto:        x=170, align=right a x=200
```

Para chofer/sucursal (4 columnas: Tracking, Fecha, Destinatario, Monto):
```
Tracking:     x=12,  ancho≈55mm  (substring 22 chars)
Fecha:        x=70,  ancho≈20mm
Destinatario: x=93,  ancho≈80mm  (substring 28 chars)
Monto:        x=200, align=right
```

Usar `align: 'right'` para los montos posicionados en `pageWidth - 12` para que nunca desborden.

### Fix 4: Cuadro financiero sin solapar el borde del header

El cuadro de resumen financiero no debe pintarse hasta que `y` esté bien posicionado después de la sección de información. Agregar una validación:

```typescript
// Asegurar que el cuadro no toque el header
if (y < 40) y = 40;
doc.rect(10, y, pageWidth - 20, boxH, 'F');
```

## Archivo a modificar

| Archivo | Cambios |
|---|---|
| `src/lib/generateSettlementPDF.ts` | Fix aspect ratio del logo, ajuste de coordenadas del header, rediseño de columnas de tabla, corrección de márgenes |

## Detalle técnico del fix del logo

`jsPDF` expone `doc.getImageProperties(base64)` que retorna `{ width, height }` en píxeles. Con eso se puede calcular el ratio exacto sin necesidad de un elemento `<img>` adicional:

```typescript
const imgProps = doc.getImageProperties(logoBase64);
const ratio = imgProps.width / imgProps.height;
const maxLogoH = 20; // mm, dentro del header de 32mm
const maxLogoW = 42; // mm máximo
let logoW = maxLogoH * ratio;
let logoH = maxLogoH;
if (logoW > maxLogoW) {
  logoW = maxLogoW;
  logoH = maxLogoW / ratio;
}
const logoX = 10;
const logoY = (headerH - logoH) / 2; // centrado vertical
doc.addImage(logoBase64, 'PNG', logoX, logoY, logoW, logoH);
```

## Resultado esperado

- Logo renderizado con su aspect ratio original (rectangular, cuadrado, o cualquier proporción) correctamente centrado en el header
- Sin solapamiento entre el header de color y el texto del cuerpo
- Columnas de la tabla bien alineadas, montos con `align: 'right'` que nunca desborden
- Diseño limpio y profesional como se ve en la imagen de referencia, sin artefactos visuales

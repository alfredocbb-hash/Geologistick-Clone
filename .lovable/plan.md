

# Mejorar visibilidad del logo en portadas PDF

## Problema

En la portada de todos los PDFs del sistema, el logo del tenant se coloca directamente sobre el fondo de color primario. Cuando el color primario del tenant es similar al color del logo (como naranja sobre naranja en BeraExpress), el logo no se distingue.

## Solucion

Agregar un fondo blanco circular (o redondeado) detras del logo en la portada, creando un "medallion" que garantice que el logo siempre sea visible sin importar el color de fondo.

## Cambio tecnico

| Archivo | Accion | Descripcion |
|---|---|---|
| `src/lib/pdfHelpers.ts` | Modificar | En la funcion `drawCoverPage`, antes de dibujar el logo, agregar un circulo blanco (o rectangulo redondeado blanco) como fondo del logo. Esto crea contraste y hace visible cualquier logo sobre cualquier color de fondo |

### Detalle del cambio

En `drawCoverPage` (linea ~90), antes de `doc.addImage(...)`:

1. Dibujar un circulo blanco centrado con `doc.setFillColor(255,255,255)` y `doc.circle()` o un rectangulo redondeado blanco ligeramente mas grande que el logo (ej: 50x50mm vs logo de 45x45mm)
2. Esto aplica automaticamente a **todos** los PDFs del sistema (Guia Flex, Terminos Flex, Guia Usuario, reportes, etc.) ya que todos usan `drawCoverPage`

El resultado visual seria: fondo de color primario -> circulo/rectangulo blanco -> logo del tenant, garantizando visibilidad en todos los casos.


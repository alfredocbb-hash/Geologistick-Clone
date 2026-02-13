

# Rediseno Etiqueta - Opcion A: Profesional Clasica (con centrado para impresion)

## Cambios en `src/pages/PrintLabel.tsx`

### 1. HTML de impresion (`generateLabelHTML`, lineas ~145-590)

**Estructura del body y centrado (lineas ~303-310, 573-589)**:
- Agregar `display: flex; justify-content: center; align-items: center;` al body para centrar la etiqueta en la pagina
- Agregar `margin: auto` a `.label` como refuerzo de centrado
- Cambiar `@page` margin de 0 a `0mm auto` para centrar horizontalmente en la hoja

**Borde exterior (linea ~319)**:
- Cambiar `border: 3px solid #000` a `border: 2px solid #000`

**Header (lineas ~349-356)**:
- Cambiar `border-bottom: 2px solid #000` a `border-bottom: 1px dashed #000`
- Eliminar icono `[S]` del header

**Tracking + QR lado a lado (lineas ~176-204)**:
- Unificar las secciones tracking y QR en un solo bloque con `display: flex; align-items: center; justify-content: center; gap: 4mm`
- Lado izquierdo: QR (mas pequeno, ~70% del tamano actual)
- Lado derecho: tracking number, badge de bulto, tracking code

**Badge de servicio (lineas ~202-204)**:
- Cambiar a `border: 2px solid #000; background: white; color: #000`
- Agregar estrellas decorativas: `★ ENTREGA A DOMICILIO ★`

**Separadores (lineas ~475-479)**:
- Cambiar `.divider` de `height: 2px; background-color: #000` a `border-bottom: 1px dashed #000; height: 0; background: none`

**Seccion destinatario (lineas ~209-220)**:
- Agregar `border-left: 3px solid #000; padding-left: 2mm`
- Reemplazar iconos `[S]`/`[D]` por `▌` y `●`

**Seccion direccion de entrega (lineas ~224-247)**:
- Reemplazar `[D]` por `●` y `[S]` por `●`

**Precio (lineas ~252-261)**:
- Aumentar font-size a 14px (compact) / 16px (standard)
- font-weight: 900

**Remitente (lineas ~274-282)**:
- Compactar en una sola linea: `REMITENTE: Nombre | Tel: xxx`

**Print styles (lineas ~573-583)**:
- Agregar reglas de centrado para `@media print`: el body usa flex centering y la etiqueta tiene margin auto

### 2. Vista previa React (lineas ~813-976)

Aplicar los mismos cambios visuales en JSX para que la preview coincida con la impresion:
- `border-[3px]` a `border-2`
- `Separator` solido a `div` con `border-b border-dashed border-black`
- QR + tracking en layout horizontal (flex row)
- Badge de servicio con estrellas y borde en vez de fondo solido
- Destinatario con barra lateral izquierda
- Iconos tipograficos en vez de `[S]` y `[D]`
- Remitente en una linea
- Precio mas grande y bold

### 3. Centrado en impresion

El centrado se logra con tres mecanismos complementarios:
- `@page { margin: 0; }` (ya existe) + el body con `display: flex; justify-content: center; align-items: center; min-height: 100vh`
- `.label { margin: 0 auto; }` como fallback
- En `@media print`, reforzar `margin: 0 auto` en `.label`

Esto garantiza que la etiqueta salga centrada tanto en impresoras termicas como en impresoras A4.




# Rediseno Etiqueta - Estilo OCA con QR Grande

## Resumen

Reemplazar completamente el diseno actual de la etiqueta en `src/pages/PrintLabel.tsx` por un layout tabular estilo OCA ePak, con el logo del tenant en la esquina superior izquierda y un QR de gran tamano en la seccion de observaciones.

## Archivo a modificar

`src/pages/PrintLabel.tsx`

## Cambios en constantes (lineas 24-43)

Aumentar `qrSize` en `LABEL_SIZES`:
- compact: 80 a 120
- standard: 100 a 150
- large: 120 a 180

## Estructura HTML de la etiqueta (funcion `generateLabelHTML`, lineas 145-608)

Reemplazar completamente el HTML y CSS del label por un diseno tabular con las siguientes secciones:

### CSS nuevo (reemplaza lineas 287-602)

**Layout general**:
- Tabla con bordes solidos de 1px negro
- Sin marca de agua (el logo va visible en el header)

**Celdas de encabezado (headers de seccion)**:
- `background: #000; color: #fff; font-size: 7-8px; font-weight: bold; padding: 1mm 2mm; text-transform: uppercase`

**Celdas de datos**:
- `background: #fff; color: #000; font-size: 10-14px; font-weight: bold; padding: 1mm 2mm`

**QR grande**:
- Usar `qrSize` al 100% (sin factor 0.7)
- Posicionado a la derecha en la seccion de observaciones

### Estructura HTML del label (reemplaza lineas 161-278)

**Fila 1 - Header**: 
- Izquierda: Logo del tenant (`logo_light`) con max-width 25mm. Si no hay logo, espacio vacio
- Derecha: Tracking number grande (16-18px) + tracking code del bulto debajo

**Fila 2 - Datos en grilla (4 columnas)**:
- Headers negros: DOC. CLIENTE | BULTO | OPERATIVA | PESO
- Datos blancos: `codigo_cliente_externo` o DNI remitente | `bultoNum / cantidad_bultos` | codigo sucursal destino | `peso_kg`

**Fila 3 - Sucursal destino**:
- Header negro "SUCURSAL DESTINO"
- Codigo de sucursal en fuente grande (18-22px)
- Letra de zona (primera letra de ciudad destino) en recuadro negro con texto blanco

**Fila 4 - Tipo de servicio**:
- Texto centrado bold con estrellas: `★ ENTREGA A DOMICILIO ★`

**Fila 5 - Destinatario**:
- Header centrado negro "DESTINATARIO"
- Nombre + DNI en una linea
- Direccion completa con CP
- Ciudad + provincia + telefono

**Fila 6 - Observaciones + QR**:
- Lado izquierdo: observaciones/notas, tipo de pago y precio
- Lado derecho: QR code grande (usando qrSize al 100%)
- El QR ocupa ~30-35% del ancho

**Fila 7 - Sucursal origen**:
- Header negro "SUCURSAL ORIGEN" + codigo y nombre

**Fila 8 - Remitente**:
- Header centrado negro "REMITENTE"
- Datos en una linea: nombre + telefono

### Centrado para impresion (se mantiene)

- body: `display: flex; justify-content: center; align-items: center; min-height: 100vh`
- .label: `margin: 0 auto`
- @media print refuerza el centrado

## Vista previa React (lineas 831-983)

Reemplazar el JSX de preview para que coincida con el nuevo diseno tabular:

- Estructura con divs simulando tabla (grid o flex)
- Headers con `bg-black text-white text-[8px] font-bold uppercase px-2 py-0.5`
- Datos con `text-sm font-bold px-2 py-1`
- Logo del tenant en header (ya se carga en `envio.logoUrl`, cambiar de watermark a imagen visible)
- QR grande: cambiar de `w-12 h-12` a `w-20 h-20` (80px)
- Grilla de 4 columnas para DOC.CLIENTE / BULTO / OPERATIVA / PESO
- Seccion observaciones con QR a la derecha usando flex

## Mapeo de campos

| Campo OCA | Campo del sistema | Fallback |
|---|---|---|
| Logo | `tenant_branding.logo_light` | Espacio vacio |
| Tracking | `envio.tracking_number` | - |
| DOC. CLIENTE | `codigo_cliente_externo` | DNI remitente |
| BULTO | `bultoNum / cantidad_bultos` | 1/1 |
| OPERATIVA | `sucursal_destino.codigo` | - |
| PESO | `peso_kg` | 0,00 |
| SUCURSAL DESTINO | `sucursal_destino.codigo + nombre` | - |
| Letra zona | Primera letra de `ciudad_entrega` | - |
| Tipo servicio | `tipoConfig.label` | SUCURSAL A SUCURSAL |
| DESTINATARIO | nombre + direccion + ciudad + tel | - |
| OBSERVACIONES | `descripcion` o `notas` | - |
| Precio / Pago | `precio_total` + `tipo_pago` | - |
| SUCURSAL ORIGEN | `sucursal_origen.codigo + nombre` | - |
| REMITENTE | nombre + telefono | - |

## Sin cambios en

- Queries de datos (lineas 617-650)
- Logica de `handlePrint` (lineas 652-719)
- Logica de `getDeliveryAddress` (lineas 670-699, 752-781)
- Selector de tamanos y botones del header (lineas 785-823)


## Cambios en la etiqueta de envío (PrintLabel)

Modificar `drawLabel` en `src/pages/PrintLabel.tsx` para mejorar la legibilidad de los datos críticos.

### 1. Bloque "Sucursal Destino" — mostrar la LOCALIDAD en grande

Hoy el bloque del medio muestra el código de sucursal (`SUC07BERA` / `-`) en grande y el nombre chico al lado. Cuando es entrega a domicilio el código suele venir vacío.

- Reemplazar el contenido principal por la **ciudad de entrega** (`ciudad_entrega || sucursal_destino.ciudad`) en mayúsculas, fuente bold grande (~22pt), centrada verticalmente.
- Mover el código/nombre de sucursal a una segunda línea pequeña debajo (sólo si existe).
- La letra de zona (recuadro negro a la derecha) se mantiene.

### 2. Destinatario — nombre y dirección más grandes

En la sección DESTINATARIO:
- Aumentar el tamaño del **nombre + DNI** de `fontBase + 1` (~9pt) a ~13pt bold.
- Aumentar la **dirección** de ~6pt a ~10pt.
- Aumentar **ciudad / provincia / tel** de ~6pt a ~9pt.
- Ampliar la altura del bloque (`destDataH`) de 16mm a ~24mm para que entre cómodo, ajustando el resto del layout hacia abajo proporcionalmente (reducir ligeramente el bloque inferior vacío del remitente).

### 3. Cantidad de bultos GRANDE en el bloque inferior vacío

El bloque debajo del REMITENTE hoy queda vacío (espacio en blanco visible en la imagen).

- Agregar una **Row 9**: dentro de ese espacio dibujar `BULTO N / TOTAL` (ej. `1 / 2`) en fuente muy grande (~48pt bold), centrado, ocupando todo el ancho y alto disponible del bloque vacío restante hasta el borde inferior de la etiqueta.
- La celda chiquita "BULTO 1/2" de la fila superior se mantiene tal cual (referencia rápida).

### Detalles técnicos

- Sólo se modifica la función `drawLabel` (líneas ~143-404). No cambia la lógica de carga de datos ni la generación multi-bulto (A4 2x2).
- Se recalcula `y` acumulado para que la suma de alturas no exceda `heightMm - m*2`. La altura libre al final del label será usada por la nueva Row 9 (bultos gigantes).
- Modo compacto (`isCompact`, etiqueta 100x150) sigue funcionando: tamaños de fuente escalan con la misma lógica.

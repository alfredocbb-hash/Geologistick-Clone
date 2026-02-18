
# Corrección QR AFIP obligatorio + inconsistencia tipo_comprobante

## Situación del error de certificado (Beraexpress)

El error de AFIP es definitivo y no tiene solución de código:
```
faultcode: ns1:cms.cert.untrusted
faultstring: Certificado no emitido por AC de confianza
```
Beraexpress tiene cargado el mismo certificado de homologación (`testafipberaexpress`) tanto en sandbox como en producción. El servidor `wsaa.afip.gov.ar` (producción) solo acepta certificados firmados por la CA de producción de AFIP. Deben:
1. Generar un CSR (Certificate Signing Request) ante AFIP con su CUIT de producción
2. Obtener el certificado firmado por AFIP producción
3. Cargarlo en Configuración → Integraciones → ARCA → Producción

Esto es un proceso administrativo ante AFIP, no un error de código.

---

## Correcciones de código a realizar

### Problema 1: QR AFIP con formato incorrecto

La RG AFIP 4291/2018 exige que el QR sea una URL específica con un JSON base64-encoded. El código actual pone el JSON directamente como valor del QR, lo cual es incorrecto.

**Formato actual (incorrecto):**
```json
{"ver":1,"fecha":"...","cuit":"...","ptoVta":1,"tipoCmp":"factura_a",...}
```

**Formato correcto AFIP:**
```
https://www.afip.gob.ar/fe/qr/?p=BASE64_ENCODED_JSON
```
Donde el JSON tiene esta estructura exacta:
```json
{
  "ver": 1,
  "fecha": "2024-01-15",
  "cuit": 20391714853,
  "ptoVta": 3,
  "tipoCmp": 6,
  "nroCmp": 1234,
  "importe": 12100.00,
  "moneda": "PES",
  "ctz": 1,
  "tipoDocRec": 96,
  "nroDocRec": 0,
  "tipoCodAut": "E",
  "codAut": 70417054367476
}
```

Códigos de tipo de comprobante para el QR:
- `1` = Factura A
- `6` = Factura B
- `11` = Factura C

Tipos de documento receptor:
- `80` = CUIT
- `96` = DNI
- `99` = Consumidor Final (nroDocRec = 0)

### Problema 2: inconsistencia tipo_comprobante

La función `arca-factura` guarda en la tabla `facturas` el campo `tipo_comprobante` con valores `'A'`, `'B'`, `'C'`. Pero `PrintInvoice.tsx` espera `'factura_a'`, `'factura_b'`, `'factura_c'` en sus mapas de etiquetas e íconos.

Esto causa que:
- El título muestre `undefined` en vez de "FACTURA A"
- `isFacturaA` sea siempre `false` (usa `.includes('_a')`)
- Los códigos AFIP en el QR sean incorrectos

**Solución**: En `PrintInvoice.tsx` normalizar el campo `tipo_comprobante` para soportar ambos formatos:
```typescript
const tipoNormalizado = factura.tipo_comprobante?.length === 1
  ? `factura_${factura.tipo_comprobante.toLowerCase()}`
  : factura.tipo_comprobante;
```

### Problema 3: QR no incluido en el PDF descargado

El PDF generado por `handleDownloadPDF` no incluye el QR AFIP, que es obligatorio en todo comprobante electrónico.

---

## Archivos a modificar

### `src/pages/PrintInvoice.tsx`

1. **Función `buildAfipQRUrl()`**: Nueva función que genera la URL correcta del QR:
   ```typescript
   function buildAfipQRUrl(factura, arcaConfig): string {
     const tipoCmpMap = { 'A': 1, 'B': 6, 'C': 11, 'factura_a': 1, 'factura_b': 6, 'factura_c': 11 };
     const tipoCmp = tipoCmpMap[factura.tipo_comprobante] || 6;
     
     const isCuit = factura.receptor_condicion_iva !== 'consumidor_final';
     const tipoDocRec = isCuit ? 80 : 99;
     const nroDocRec = factura.receptor_cuit 
       ? parseInt(factura.receptor_cuit.replace(/-/g, ''))
       : 0;
     
     const qrJson = {
       ver: 1,
       fecha: format(new Date(factura.fecha_emision || new Date()), 'yyyy-MM-dd'),
       cuit: parseInt((arcaConfig?.cuit || '').replace(/-/g, '')),
       ptoVta: factura.punto_venta || 1,
       tipoCmp,
       nroCmp: factura.numero_comprobante || 1,
       importe: factura.importe_total,
       moneda: 'PES',
       ctz: 1,
       tipoDocRec,
       nroDocRec,
       tipoCodAut: 'E',
       codAut: parseInt(factura.cae || '0'),
     };
     
     const base64 = btoa(JSON.stringify(qrJson));
     return `https://www.afip.gob.ar/fe/qr/?p=${base64}`;
   }
   ```

2. **Normalización tipo_comprobante**: Usar `tipoNormalizado` en todo el componente en lugar de `factura.tipo_comprobante` directamente para los labels y `isFacturaA`.

3. **Incluir QR en PDF**: Agregar el QR como imagen en el PDF descargado usando `QRCode.toDataURL` o `html2canvas` del elemento QR del DOM.

---

## Resultado esperado

- El QR en la factura impresa apuntará a `https://www.afip.gob.ar/fe/qr/?p=...` que al escanearlo abre AFIP con los datos del comprobante para verificación
- El título mostrará correctamente "FACTURA A", "FACTURA B" o "FACTURA C"
- El PDF descargado también incluirá el QR AFIP
- Se mostrará un mensaje claro cuando el certificado de producción sea inválido, indicando a Beraexpress qué deben hacer

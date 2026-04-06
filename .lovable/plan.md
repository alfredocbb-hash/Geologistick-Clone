

## Plan: Sidebar respeta temas + OCR extrae todos los datos del comprobante

### Parte 1: Sidebar y menú respetan los temas

**Problema**: El sidebar usa la variable `--geo-teal` hardcodeada para el gradiente del item activo, y posiblemente otros colores que no cambian con el tema.

**Solución en `src/index.css`**:
- Agregar variable `--geo-teal` a cada tema con un valor acorde a la paleta:
  - Light/Dark: valor actual (teal)
  - Midnight: tono índigo/violeta
  - Logistics Blue: tono cyan/teal

**Solución en `src/components/layout/AppSidebar.tsx`**:
- Verificar que el gradiente del icono activo (`from-[hsl(var(--geo-teal))] to-[hsl(var(--primary))]`) ya usa variables CSS, lo que debería funcionar automáticamente una vez que `--geo-teal` esté definida en cada tema.

### Parte 2: OCR extrae TODOS los datos del comprobante

**Problema actual**: El prompt de la Edge Function `ocr-label` solo extrae 8 campos (mlShipmentId, trackingNumber, direccion, codigoPostal, localidad, barrio, nombreDestinatario, referencia). No extrae remitente, teléfonos, email, provincia, DNI, peso, bultos, etc.

**Solución en `supabase/functions/ocr-label/index.ts`**:
- Ampliar el prompt para extraer campos adicionales:
  - `nombreRemitente`: Nombre del remitente/emisor
  - `direccionRetiro`: Dirección de origen/retiro
  - `telefonoDestinatario`: Teléfono del destinatario
  - `emailDestinatario`: Email del destinatario
  - `provincia`: Provincia
  - `dniDestinatario`: DNI del destinatario
  - `cantidadBultos`: Cantidad de bultos/paquetes
  - `pesoKg`: Peso en kg
  - `valorDeclarado`: Valor declarado
  - `tipoPago`: Tipo de pago (contra entrega, etc.)
- Actualizar el JSON de respuesta para incluir estos campos nuevos

**Solución en `src/components/mobile/BulkOCRScreen.tsx`**:
- En `processOnePhoto`: mapear los nuevos campos OCR a las columnas correspondientes de `envios`:
  - `nombre_remitente` ← `nombreRemitente`
  - `direccion_retiro` ← `direccionRetiro`
  - `whatsapp_destinatario` ← `telefonoDestinatario`
  - `email_destinatario` ← `emailDestinatario`
  - `provincia` ← `provincia`
  - `dni_destinatario` ← `dniDestinatario`
  - `cantidad_bultos` ← `cantidadBultos`
  - `peso_kg` ← `pesoKg`
  - `valor_declarado` ← `valorDeclarado`
- Hacer lo mismo en el bloque de inserción del modo ráfaga (burst)

**Solución en `src/components/mobile/OCRCaptureDialog.tsx`**:
- Agregar los campos nuevos al formulario de confirmación (pantalla de edición antes de guardar)
- Actualizar `OCRConfirmData` para incluir los nuevos campos

### Archivos a modificar
- `src/index.css` — Agregar `--geo-teal` a los 4 temas
- `supabase/functions/ocr-label/index.ts` — Ampliar prompt y respuesta con ~10 campos nuevos
- `src/components/mobile/BulkOCRScreen.tsx` — Mapear campos nuevos en insert de envios
- `src/components/mobile/OCRCaptureDialog.tsx` — Agregar campos al formulario y al tipo OCRConfirmData


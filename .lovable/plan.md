
# Diagnóstico y corrección del error de facturación ARCA en producción

## Causa raíz identificada

La función `arca-factura` tiene la integración SOAP con AFIP **sin implementar** para el ambiente de producción. La función `emitirFacturaARCA` está así:

```typescript
// Sandbox: simula CAE correctamente
if (environment === 'sandbox') { ... return { success: true, cae: ... } }

// Producción: SIEMPRE devuelve error, sin importar la configuración
return {
  success: false,
  error: 'Integración ARCA en producción requiere certificados configurados',
};
```

Esto significa que aunque Beraexpress configure certificados reales de producción, la factura siempre será rechazada.

## Problema secundario detectado

Los certificados cargados en `production` son exactamente los mismos que en `sandbox`. El CN del certificado dice `testafipberaexpress`, lo que indica que son certificados de homologación (testing), no de producción real de AFIP. Esto es algo que Beraexpress debe resolver por su cuenta ante AFIP: solicitar el certificado de producción.

Sin embargo, el código debe estar preparado para cuando tengan el certificado correcto.

## Solución propuesta

Implementar la comunicación SOAP real con los servicios de AFIP/ARCA en la función `emitirFacturaARCA`. El flujo AFIP requiere dos pasos:

### Paso 1 - Autenticación con WSAA (Web Service de Autenticación y Autorización)
- Generar un "Ticket de Requerimiento de Acceso" (TRA) firmado con la clave privada + certificado del tenant
- Llamar al endpoint WSAA para obtener el Token de Acceso (TA)

### Paso 2 - Emisión con WSFEv1 (Web Service de Facturación Electrónica)
- Usar el Token + Sign del paso anterior
- Llamar a `FECAESolicitar` con los datos del comprobante
- Recuperar el CAE y su fecha de vencimiento

### Arquitectura del cambio

```
emitirFacturaARCA(config, 'production', ...)
    │
    ├─ generarTRA()           → XML firmado con cert+key del tenant
    ├─ autenticarWSAA()       → POST SOAP → devuelve { token, sign }
    └─ solicitarCAE()         → POST SOAP → devuelve { CAE, CAEFchVto }
```

### Implementación en `supabase/functions/arca-factura/index.ts`

Se reemplazará el bloque de producción que hoy devuelve error por la implementación real:

```typescript
// 1. Generar TRA (Ticket de Requerimiento de Acceso)
async function generarTRA(): string {
  const now = new Date();
  const generationTime = new Date(now.getTime() - 10000).toISOString().replace('.000Z', '-03:00');
  const expirationTime = new Date(now.getTime() + 600000).toISOString().replace('.000Z', '-03:00');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
    <generationTime>${generationTime}</generationTime>
    <expirationTime>${expirationTime}</expirationTime>
  </header>
  <service>wsfe</service>
</loginTicketRequest>`;
}

// 2. Firmar con key privada + certificado usando Deno crypto
async function firmarTRA(tra: string, privateKey: string, cert: string): Promise<string> {
  // Usar SubtleCrypto de Deno para firma PKCS7/CMS
  // Devuelve base64 del CMS firmado
}

// 3. Llamar WSAA
async function autenticarWSAA(cmsFirmado: string, wsaaUrl: string): Promise<{token: string, sign: string}> {
  const soapBody = `<soapenv:Envelope ...>
    <loginCms in0="${cmsFirmado}" />
  </soapenv:Envelope>`;
  // POST a wsaaUrl, parsear XML respuesta
}

// 4. Llamar WSFEv1
async function solicitarCAE(token, sign, cuit, puntoVenta, tipo, numero, receptor, montos, wsfeUrl) {
  const soapBody = `<FECAESolicitar>
    <Auth><Token>...</Token><Sign>...</Sign><Cuit>...</Cuit></Auth>
    <FeCAEReq>...</FeCAEReq>
  </FECAESolicitar>`;
  // POST, parsear CAE y fecha vencimiento
}
```

### Manejo de errores mejorado

La nueva implementación debe:
- Capturar errores SOAP de AFIP con sus códigos (Ej: `Err.Code 10016 - Fecha fuera de rango`)
- Loguear el XML de request/response para diagnóstico
- Si falla la auth WSAA, informar claramente (certificado inválido, expirado, etc.)
- Si falla WSFEv1, mostrar el mensaje de AFIP textualmente

### Comunicación al cliente

Mientras se implementa la integración real, se debe informar a Beraexpress que:
1. El certificado cargado en producción es el de **homologación** (testing), no el de producción real
2. Deben solicitar ante AFIP el certificado de producción para el CUIT 30-71726581-1
3. Una vez que tengan el certificado de producción, recargarlo en Configuración → Integraciones → ARCA → Producción

## Archivos a modificar

- **`supabase/functions/arca-factura/index.ts`**: Implementar `generarTRA()`, `firmarTRA()`, `autenticarWSAA()`, `solicitarCAE()` y reemplazar el bloque de producción con la llamada real a AFIP.

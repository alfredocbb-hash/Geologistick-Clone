# Mejora de UX: error claro cuando ARCA no autoriza el servicio de padrón

## Contexto

Al probar con MD CARGAS (CUIT 30-71173121-7), ARCA respondió:
`WSAA fault: Computador no autorizado a acceder al servicio`

Esto significa que el certificado digital del tenant no tiene habilitado el servicio `ws_sr_padron_a13` en AFIP. Es una configuración que debe hacer el usuario en AFIP (no en el código), pero el mensaje actual al usuario es genérico.

## Cambios

### 1. `supabase/functions/arca-consultar-padron/index.ts`
- Detectar el fault `"Computador no autorizado"` (case-insensitive) en la respuesta de WSAA.
- Devolver una respuesta estructurada con `error_code: "SERVICE_NOT_AUTHORIZED"` y un mensaje descriptivo (HTTP 200 con `success: false` para que el frontend lo maneje sin try/catch raro).
- Mantener el resto de errores (cert faltante, CUIT inválido, no encontrado) con sus códigos actuales.

### 2. `src/pages/ThirdPartyCompanies.tsx`
- En `lookupArcaPadron`, cuando `error_code === "SERVICE_NOT_AUTHORIZED"`, mostrar un `toast.error` con título y descripción larga:
  - Título: *"Servicio ARCA no habilitado"*
  - Descripción: *"El certificado fiscal no tiene autorizado el servicio de consulta de padrón (ws_sr_padron_a13). Habilitalo en AFIP → Administrador de Relaciones de Clave Fiscal → Nueva Relación → buscar 'WS Consulta a Padrón Alcance 13' y asociarlo al mismo certificado de facturación electrónica."*
  - `duration: 10000` para que dé tiempo a leer.
- Mantener el resto de toasts (éxito, no encontrado, error genérico) sin cambios.

## Resultado esperado

Al ingresar 30-71173121-7 (MD CARGAS), si AFIP sigue rechazando, el operador verá un mensaje claro con instrucciones accionables en vez de un error técnico. Una vez habilitado el servicio en AFIP, la consulta autocompletará razón social, domicilio, ciudad, provincia y CP automáticamente.

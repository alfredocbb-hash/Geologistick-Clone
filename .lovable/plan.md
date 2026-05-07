## Objetivo

Al cargar/editar una empresa terciarizada, cuando se ingresa el CUIT, autocompletar Razón Social, Domicilio (calle, ciudad, provincia, CP) y condición frente al IVA consultando el padrón de ARCA/AFIP.

## Estado actual

- `src/pages/ThirdPartyCompanies.tsx` tiene un input de CUIT (línea 556-561) sin lookup automático.
- `src/hooks/useCuitLookup.ts` solo busca en tablas internas (`clientes`, `empresas_terciarizadas`); no consulta ARCA.
- `supabase/functions/arca-factura/index.ts` ya implementa autenticación WSAA con certificado/clave del tenant y caché de tokens, pero solo para el servicio `wsfe` (facturación). No existe función para consultar el padrón.

ARCA expone el servicio **`ws_sr_padron_a13`** que devuelve, dado un CUIT: razón social/nombre, domicilio fiscal, provincia, código postal, categoría (RI / Monotributo / Exento / etc.). Requiere su propio token WSAA (mismo cert, distinto `service`) y un SOAP a `https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA13` (prod) / `https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA13` (homo).

## Cambios

### 1. Nueva edge function `arca-consultar-padron`

`supabase/functions/arca-consultar-padron/index.ts`:

- Recibe `{ cuit, environment? }` desde el frontend autenticado.
- Resuelve `tenant_id` desde el JWT y carga `arca_config` (cert + private key) del tenant, igual que `arca-factura`.
- Reutiliza la lógica de `autenticarWSAA` y caché, pero generando un TRA con `service = "ws_sr_padron_a13"` (cachear bajo otra clave: `cache_wsaa_padron_token`/`sign`/`expires_at` para no chocar con el de `wsfe`).
- Llama por SOAP a `personaServiceA13.getPersona` con `{ token, sign, cuitRepresentada: <cuit del tenant>, idPersona: <cuit consultado> }`.
- Parsea la respuesta y devuelve un JSON normalizado:
  ```json
  {
    "found": true,
    "cuit": "30-12345678-9",
    "razon_social": "...",
    "nombre": "...",
    "tipo_persona": "FISICA"|"JURIDICA",
    "condicion_iva": "responsable_inscripto"|"monotributo"|"exento"|"consumidor_final",
    "domicilio": "Calle 123",
    "ciudad": "...",
    "provincia": "...",
    "codigo_postal": "...",
    "estado": "ACTIVO"|"INACTIVO"
  }
  ```
- Manejo de errores: CUIT inválido, persona no encontrada, ARCA caído, falta de configuración del tenant. Devuelve `{ found: false, reason }` con HTTP 200 para casos esperables; 4xx/5xx para errores reales.
- `verify_jwt = true` (default) — requiere usuario logueado.

### 2. Integración en el formulario de empresa terciarizada

En `src/pages/ThirdPartyCompanies.tsx`:

- Al perder foco el input CUIT (`onBlur`) o cuando cambie a 11 dígitos válidos:
  1. Limpiar/normalizar (solo dígitos, validar longitud y dígito verificador con `validateCUIT` de `useARCAConfig`).
  2. Llamar a la edge function vía `supabase.functions.invoke('arca-consultar-padron', { body: { cuit } })`.
  3. Mostrar un spinner pequeño al lado del input.
  4. Si responde `found: true`, autocompletar SOLO los campos vacíos (no pisar datos ya editados por el usuario): `razon_social`, `nombre` (si está vacío), `direccion`, `ciudad`, `provincia`, `codigo_postal`. Mostrar `toast.success("Datos traídos de ARCA")`.
  5. Si `found: false` o error: `toast` informativo y dejar al usuario completar manualmente.
- Agregar formateo automático del CUIT a `XX-XXXXXXXX-X` al escribir.

### 3. Extender `useCuitLookup` (opcional, mismo flujo reutilizable)

Agregar un método `lookupArca(cuit)` al hook que envuelva la llamada a la edge function, para reutilizarlo después en `Clientes` y `PurchaseInvoiceForm`. En esta tarea solo se conecta al formulario de empresa terciarizada; los demás quedan iguales.

## Notas

- Requiere que el tenant ya tenga ARCA configurado (cert + private key + CUIT). Si no lo tiene, la edge function devuelve un error claro y el frontend muestra: "Configurá ARCA en Facturación para autocompletar desde el padrón". El campo sigue siendo editable manualmente.
- En sandbox, el padrón A13 también funciona contra el ambiente de homologación; se respeta el `environment` configurado en `arca_config`.
- No se modifica el esquema de BD. La caché del token de padrón se guarda en la tabla existente `integration_config` con keys nuevas (`cache_wsaa_padron_*`).

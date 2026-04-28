import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ARCA/AFIP endpoints
const ARCA_ENDPOINTS = {
  sandbox: {
    wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
  },
  production: {
    wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
  },
};

// IVA conditions and their corresponding tax ID types
const IVA_CONDITIONS: Record<string, { docTipo: number; description: string }> = {
  responsable_inscripto: { docTipo: 80, description: 'CUIT' },
  monotributo: { docTipo: 80, description: 'CUIT' },
  exento: { docTipo: 80, description: 'CUIT' },
  consumidor_final: { docTipo: 99, description: 'Consumidor Final' },
};

// Invoice type codes for AFIP
const INVOICE_CODES = {
  A: { factura: 1, notaCredito: 3, notaDebito: 2 },
  B: { factura: 6, notaCredito: 8, notaDebito: 7 },
  C: { factura: 11, notaCredito: 13, notaDebito: 12 },
};

interface FacturaRequest {
  envio_id?: string;
  liquidacion_seller_id?: string;
  liquidacion_terciarizado_id?: string;
  tipo_comprobante: 'A' | 'B' | 'C';
  environment?: 'sandbox' | 'production';
  receptor: {
    cuit?: string;
    dni?: string;
    nombre: string;
    condicion_iva: string;
    domicilio?: string;
  };
  importe_total?: number;
  // AFIP-standard fields
  concepto?: number; // 1=Productos, 2=Servicios, 3=Ambos
  tipo_documento?: number; // 80=CUIT, 96=DNI, 99=Sin Identificar
  condicion_venta?: string;
  fecha_servicio_desde?: string; // YYYY-MM-DD
  fecha_servicio_hasta?: string;
  fecha_vto_pago?: string;
  importe_no_gravado?: number;
  importe_exento?: number;
  importe_tributos?: number;
  descripcion?: string;
  line_items?: Array<{
    codigo?: string;
    descripcion: string;
    cantidad: number;
    unidad_medida?: string;
    precio_unitario: number;
    bonificacion_pct?: number;
    subtotal: number;
    alicuota_iva?: number;
  }>;
}

interface ARCAConfig {
  cuit: string;
  cert_pem: string;
  private_key: string;
  punto_venta: string;
}

// ─────────────────────────────────────────────
// ASN.1 / DER helpers for CMS signature
// ─────────────────────────────────────────────

function derLength(len: number): Uint8Array {
  if (len < 128) return new Uint8Array([len]);
  if (len < 256) return new Uint8Array([0x81, len]);
  return new Uint8Array([0x82, (len >> 8) & 0xff, len & 0xff]);
}

function derTLV(tag: number, value: Uint8Array): Uint8Array {
  const lenBytes = derLength(value.length);
  const result = new Uint8Array(1 + lenBytes.length + value.length);
  result[0] = tag;
  result.set(lenBytes, 1);
  result.set(value, 1 + lenBytes.length);
  return result;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

function derSequence(...items: Uint8Array[]): Uint8Array {
  return derTLV(0x30, concat(...items));
}

function derSet(...items: Uint8Array[]): Uint8Array {
  return derTLV(0x31, concat(...items));
}

function derOID(oid: number[]): Uint8Array {
  const encoded: number[] = [];
  // First two components combined
  encoded.push(40 * oid[0] + oid[1]);
  for (let i = 2; i < oid.length; i++) {
    let val = oid[i];
    const parts: number[] = [];
    parts.push(val & 0x7f);
    val >>= 7;
    while (val > 0) {
      parts.unshift((val & 0x7f) | 0x80);
      val >>= 7;
    }
    encoded.push(...parts);
  }
  return derTLV(0x06, new Uint8Array(encoded));
}

function derInteger(bytes: Uint8Array, treatAsPositive = true): Uint8Array {
  let value = bytes;
  if (treatAsPositive && bytes[0] & 0x80) {
    value = concat(new Uint8Array([0x00]), bytes);
  }
  return derTLV(0x02, value);
}

function derOctetString(bytes: Uint8Array): Uint8Array {
  return derTLV(0x04, bytes);
}

function derUTF8String(text: string): Uint8Array {
  return derTLV(0x0c, new TextEncoder().encode(text));
}

function derContextImplicit(tag: number, content: Uint8Array): Uint8Array {
  return derTLV(0xa0 + tag, content);
}

// Parse PEM certificate to DER bytes
function pemToDer(pem: string): Uint8Array {
  const base64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/-----BEGIN RSA PRIVATE KEY-----/g, '')
    .replace(/-----END RSA PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(base64);
  return new Uint8Array(binary.length).map((_, i) => binary.charCodeAt(i));
}

// Extract serial number from DER certificate
function extractSerialFromCert(certDer: Uint8Array): Uint8Array {
  // TBSCertificate is inside Certificate SEQUENCE → first child
  // Skip outer SEQUENCE tag+len, then TBS SEQUENCE tag+len
  // Certificate ::= SEQUENCE { tbsCertificate TBSCertificate, ... }
  // TBSCertificate ::= SEQUENCE { version [0], serialNumber INTEGER, ... }
  let offset = 0;
  // outer SEQUENCE
  if (certDer[offset++] !== 0x30) throw new Error('Invalid cert DER');
  offset += certDer[offset] < 128 ? 1 : (certDer[offset] & 0x7f) + 1;
  // TBS SEQUENCE
  if (certDer[offset++] !== 0x30) throw new Error('Invalid TBS SEQUENCE');
  offset += certDer[offset] < 128 ? 1 : (certDer[offset] & 0x7f) + 1;
  // optional version [0]
  if (certDer[offset] === 0xa0) {
    offset++;
    const vLen = certDer[offset++];
    offset += vLen;
  }
  // serialNumber INTEGER
  if (certDer[offset++] !== 0x02) throw new Error('Expected INTEGER for serial');
  const sLen = certDer[offset++];
  return certDer.slice(offset, offset + sLen);
}

// Extract issuer from DER certificate (raw DER bytes of the Name)
function extractIssuerFromCert(certDer: Uint8Array): Uint8Array {
  let offset = 0;
  // outer SEQUENCE
  if (certDer[offset++] !== 0x30) throw new Error('Invalid cert DER');
  offset += certDer[offset] < 128 ? 1 : (certDer[offset] & 0x7f) + 1;
  // TBS SEQUENCE  
  if (certDer[offset++] !== 0x30) throw new Error('Invalid TBS SEQUENCE');
  const tbsStart = offset;
  offset += certDer[offset] < 128 ? 1 : (certDer[offset] & 0x7f) + 1;
  // optional version [0]
  if (certDer[offset] === 0xa0) {
    offset++;
    const vLen = certDer[offset++];
    offset += vLen;
  }
  // serialNumber INTEGER
  if (certDer[offset++] !== 0x02) throw new Error('Expected INTEGER for serial');
  const sLen = certDer[offset < 128 ? offset++ : offset++];
  offset += sLen;
  // signature AlgorithmIdentifier SEQUENCE
  if (certDer[offset++] !== 0x30) throw new Error('Expected AlgorithmIdentifier');
  const algLen = certDer[offset] < 128 ? certDer[offset++] : (() => { const n = certDer[offset] & 0x7f; offset++; let v = 0; for(let i=0;i<n;i++) v = (v<<8)|certDer[offset++]; return v; })();
  offset += algLen;
  // issuer Name SEQUENCE – capture raw bytes including tag+len
  const issuerStart = offset;
  if (certDer[offset++] !== 0x30) throw new Error('Expected issuer SEQUENCE');
  const issuerContentLen = certDer[offset] < 128 ? certDer[offset++] : (() => { const n = certDer[offset] & 0x7f; offset++; let v = 0; for(let i=0;i<n;i++) v = (v<<8)|certDer[offset++]; return v; })();
  offset += issuerContentLen;
  return certDer.slice(issuerStart, offset);
}

// Import RSA private key from PEM
async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  const derBytes = pemToDer(pemKey);
  // Try PKCS8 first
  try {
    return await crypto.subtle.importKey(
      'pkcs8',
      derBytes,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
  } catch {
    throw new Error('Failed to import private key. Ensure it is in PKCS8 (PEM) format.');
  }
}

// ─────────────────────────────────────────────
// CMS SignedData builder (minimal, for AFIP WSAA)
// ─────────────────────────────────────────────

async function buildCMSSignedData(
  content: Uint8Array,
  certPem: string,
  privateKeyPem: string
): Promise<Uint8Array> {
  const certDer = pemToDer(certPem);
  const cryptoKey = await importPrivateKey(privateKeyPem);
  
  // Sign the content (SHA-256 digest)
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, cryptoKey, content)
  );

  // OIDs
  const oidData          = derOID([1,2,840,113549,1,7,1]); // data
  const oidSignedData    = derOID([1,2,840,113549,1,7,2]); // signedData
  const oidSha256        = derSequence(derOID([2,16,840,1,101,3,4,2,1]), derTLV(0x05, new Uint8Array(0)));
  const oidRsaEncryption = derSequence(derOID([1,2,840,113549,1,1,1]), derTLV(0x05, new Uint8Array(0)));

  // Extract cert fields
  const serialBytes = extractSerialFromCert(certDer);
  const issuerBytes  = extractIssuerFromCert(certDer);

  // IssuerAndSerialNumber
  const issuerAndSerial = derSequence(issuerBytes, derInteger(serialBytes, false));

  // DigestAlgorithmIdentifiers SET
  const digestAlgSet = derSet(oidSha256);

  // EncapsulatedContentInfo: data content
  const encapContent = derSequence(
    oidData,
    derContextImplicit(0, derOctetString(content))
  );

  // Certificates [0] IMPLICIT
  const certsField = derContextImplicit(0, certDer);

  // SignerInfo
  const signerInfo = derSequence(
    derInteger(new Uint8Array([1])),   // version
    issuerAndSerial,
    oidSha256,                          // digestAlgorithm
    oidRsaEncryption,                   // signatureAlgorithm
    derOctetString(signature)           // signature
  );
  
  const signerInfoSet = derSet(signerInfo);

  // SignedData
  const signedData = derSequence(
    derInteger(new Uint8Array([1])),    // version
    digestAlgSet,
    encapContent,
    certsField,
    signerInfoSet
  );

  // ContentInfo
  const contentInfo = derSequence(
    oidSignedData,
    derContextImplicit(0, signedData)
  );

  return contentInfo;
}

// ─────────────────────────────────────────────
// TRA generation
// ─────────────────────────────────────────────

function generarTRA(): string {
  const now = new Date();
  // Ajustar a Argentina (UTC-3): restar 3 horas ANTES de aplicar el sufijo -03:00
  // Sin esto, AFIP interpreta la hora UTC con offset -03:00 → 3 horas en el futuro
  const AR_OFFSET_MS = 3 * 60 * 60 * 1000; // 3 horas en ms
  const genTime = new Date(now.getTime() - 60000);   // 1 min antes
  const expTime = new Date(now.getTime() + 600000);  // 10 min después

  const fmt = (d: Date) => {
    // Restar 3h (UTC → hora Argentina) y aplicar sufijo -03:00
    const argTime = new Date(d.getTime() - AR_OFFSET_MS);
    return argTime.toISOString().replace('Z', '-03:00');
  };

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<loginTicketRequest version="1.0">\n` +
    `  <header>\n` +
    `    <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>\n` +
    `    <generationTime>${fmt(genTime)}</generationTime>\n` +
    `    <expirationTime>${fmt(expTime)}</expirationTime>\n` +
    `  </header>\n` +
    `  <service>wsfe</service>\n` +
    `</loginTicketRequest>`;
}

// ─────────────────────────────────────────────
// WSAA Authentication
// ─────────────────────────────────────────────

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_: string, dec: string) => String.fromCharCode(parseInt(dec)));
}

async function autenticarWSAA(
  certPem: string,
  privateKeyPem: string,
  wsaaUrl: string
): Promise<{ token: string; sign: string }> {
  const tra = generarTRA();
  console.log('[ARCA] TRA generado:', tra);

  const traBytes = new TextEncoder().encode(tra);
  const cms = await buildCMSSignedData(traBytes, certPem, privateKeyPem);
  const cmsBase64 = btoa(String.fromCharCode(...cms));

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cmsBase64}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

  console.log('[ARCA] Llamando WSAA:', wsaaUrl);

  const response = await fetch(wsaaUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': '',
    },
    body: soapEnvelope,
  });

  const responseText = await response.text();
  console.log('[ARCA] WSAA Response status:', response.status);
  console.log('[ARCA] WSAA Response body:', responseText.substring(0, 2000));

  // Decodificar HTML entities (AFIP sandbox devuelve &lt;token&gt; dentro de loginCmsReturn)
  const decodedResponse = decodeHtmlEntities(responseText);

  // Detectar fault code ANTES que el status HTTP (AFIP devuelve 500 con body útil)
  const faultCodeMatch = decodedResponse.match(/<faultcode[^>]*>([\s\S]*?)<\/faultcode>/);
  const faultStringMatch = decodedResponse.match(/<faultstring>([\s\S]*?)<\/faultstring>/);

  // coe.alreadyAuthenticated → AFIP ya tiene un TA válido para este certificado.
  // Lanzamos un sentinel especial para que el caller pueda usar el token cacheado.
  if (faultCodeMatch && faultCodeMatch[1].includes('coe.alreadyAuthenticated')) {
    console.log('[ARCA] WSAA: TA ya vigente (coe.alreadyAuthenticated) - se intentará usar token cacheado');
    throw new Error('WSAA_ALREADY_AUTHENTICATED');
  }

  // Otros SOAP faults → error real
  if (faultStringMatch) {
    throw new Error(`WSAA SOAP Fault: ${faultStringMatch[1]}`);
  }

  if (!response.ok) {
    throw new Error(`WSAA HTTP error ${response.status}: ${responseText.substring(0, 500)}`);
  }

  // Parse token and sign from decoded XML response
  const tokenMatch = decodedResponse.match(/<token>([\s\S]*?)<\/token>/);
  const signMatch  = decodedResponse.match(/<sign>([\s\S]*?)<\/sign>/);

  if (!tokenMatch || !signMatch) {
    throw new Error(`WSAA: No se pudo extraer token/sign. Respuesta: ${responseText.substring(0, 500)}`);
  }

  return {
    token: tokenMatch[1].trim(),
    sign:  signMatch[1].trim(),
  };
}

// ─────────────────────────────────────────────
// WSAA Token Cache (usa system_integrations)
// ─────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function getCachedToken(supabase: any, tenantId: string, environment: string): Promise<{ token: string; sign: string } | null> {
  try {
    const { data } = await supabase
      .from('system_integrations')
      .select('config_key, config_value')
      .eq('integration_type', 'arca')
      .eq('environment', environment)
      .eq('tenant_id', tenantId)
      .in('config_key', ['cache_wsaa_token', 'cache_wsaa_sign', 'cache_wsaa_expires_at']);

    if (!data || data.length === 0) return null;

    const map: Record<string, string> = {};
    // deno-lint-ignore no-explicit-any
    data.forEach((r: any) => { map[r.config_key] = r.config_value; });

    if (!map.cache_wsaa_token || !map.cache_wsaa_sign || !map.cache_wsaa_expires_at) return null;

    // Verificar que el token siga válido (con 5 min de margen)
    const expiresAt = new Date(map.cache_wsaa_expires_at);
    const bufferMs = 5 * 60 * 1000;
    if (expiresAt.getTime() - bufferMs <= Date.now()) {
      console.log('[ARCA] Token cacheado expirado:', map.cache_wsaa_expires_at);
      return null;
    }

    console.log('[ARCA] Usando token cacheado válido, expira:', map.cache_wsaa_expires_at);
    return { token: map.cache_wsaa_token, sign: map.cache_wsaa_sign };
  } catch (e) {
    console.warn('[ARCA] Error leyendo cache de token:', e);
    return null;
  }
}

// deno-lint-ignore no-explicit-any
async function setCachedToken(supabase: any, tenantId: string, environment: string, token: string, sign: string): Promise<void> {
  try {
    // Los tokens AFIP duran 12 horas; guardamos con ese vencimiento
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    // Usamos integration_type 'arca' (valor válido del enum) con config_keys prefijados 'cache_wsaa_*'
    const entries = [
      { config_key: 'cache_wsaa_token',      config_value: token },
      { config_key: 'cache_wsaa_sign',        config_value: sign },
      { config_key: 'cache_wsaa_expires_at',  config_value: expiresAt },
    ];
    for (const entry of entries) {
      const { error: upsertError } = await supabase.from('system_integrations').upsert({
        integration_type: 'arca',
        environment,
        tenant_id: tenantId,
        config_key: entry.config_key,
        config_value: entry.config_value,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,integration_type,config_key,environment' });
      if (upsertError) console.warn('[ARCA] Error guardando entrada de caché:', entry.config_key, upsertError.message);
    }
    console.log('[ARCA] Token guardado en caché hasta:', expiresAt);
  } catch (e) {
    console.warn('[ARCA] Error guardando token en caché:', e);
  }
}

// Obtener token WSAA con caché: primero busca uno vigente, si no existe autentica contra AFIP.
// deno-lint-ignore no-explicit-any
async function getWSAAToken(supabase: any, tenantId: string, environment: string, arcaConfig: ARCAConfig): Promise<{ token: string; sign: string }> {
  // 1. Intentar con el token cacheado
  const cached = await getCachedToken(supabase, tenantId, environment);
  if (cached) return cached;

  // 2. Autenticar fresh
  const endpoints = ARCA_ENDPOINTS[environment as 'sandbox' | 'production'];
  try {
    const result = await autenticarWSAA(arcaConfig.cert_pem, arcaConfig.private_key, endpoints.wsaa);
    await setCachedToken(supabase, tenantId, environment, result.token, result.sign);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'WSAA_ALREADY_AUTHENTICATED') {
      // AFIP tiene un TA vigente pero no tenemos el token en caché.
      // No podemos obtener un nuevo token hasta que expire el actual (hasta 12 horas).
      // Usamos un prefijo especial para que el caller lo distinga de un rechazo real.
      throw new Error(
        'ARCA_SESSION_CONFLICT: AFIP ya tiene una sesión activa para este certificado. ' +
        'El token se cacheará automáticamente en la próxima sesión exitosa. ' +
        'Espere hasta 12 horas o consulte con soporte.'
      );
    }
    throw err;
  }
}

// ─────────────────────────────────────────────
// WSFEv1 – FECAESolicitar
// ─────────────────────────────────────────────

async function solicitarCAE(
  token: string,
  sign: string,
  cuit: string,
  puntoVenta: number,
  tipoComprobante: 'A' | 'B' | 'C',
  numeroComprobante: number,
  receptor: FacturaRequest['receptor'],
  importeNeto: number,
  importeIva: number,
  importeTotal: number,
  wsfeUrl: string,
  opts?: {
    concepto?: number;
    tipoDocumento?: number;
    fechaServicioDesde?: string;
    fechaServicioHasta?: string;
    fechaVtoPago?: string;
    importeNoGravado?: number;
    importeExento?: number;
    importeTributos?: number;
  }
): Promise<{ cae: string; caeVencimiento: string }> {
  const tipoComprobanteCode = INVOICE_CODES[tipoComprobante].factura;
  const ivaCondition = IVA_CONDITIONS[receptor.condicion_iva] || IVA_CONDITIONS.consumidor_final;
  
  // Use explicit tipo_documento from opts if provided, otherwise infer from IVA condition
  const docTipo = opts?.tipoDocumento ?? ivaCondition.docTipo;
  const docNro = docTipo === 99
    ? '0'
    : (receptor.cuit?.replace(/[-]/g, '') || receptor.dni || '0');

  const nowMs = Date.now();
  const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
  const argentinaDate = new Date(nowMs - AR_OFFSET_MS);
  const fechaComprobante = `${argentinaDate.getUTCFullYear()}${String(argentinaDate.getUTCMonth()+1).padStart(2,'0')}${String(argentinaDate.getUTCDate()).padStart(2,'0')}`;

  const conceptoValue = opts?.concepto ?? 1;
  const impTotConc = (opts?.importeNoGravado ?? 0).toFixed(2);
  const impOpEx = (opts?.importeExento ?? 0).toFixed(2);
  const impTrib = (opts?.importeTributos ?? 0).toFixed(2);

  const condicionIvaReceptorCode: Record<string, number> = {
    responsable_inscripto: 1,
    exento: 4,
    consumidor_final: 5,
    monotributo: 6,
    no_responsable: 7,
  };
  const condicionIvaReceptorNumero = condicionIvaReceptorCode[receptor.condicion_iva] ?? 5;

  const ivaBlock = importeIva > 0.005
    ? `<ar:Iva><ar:AlicIva><ar:Id>5</ar:Id><ar:BaseImp>${importeNeto.toFixed(2)}</ar:BaseImp><ar:Importe>${importeIva.toFixed(2)}</ar:Importe></ar:AlicIva></ar:Iva>`
    : '';

  // Service dates block (required when Concepto = 2 or 3)
  const fmtDate = (d: string) => d.replace(/-/g, '');
  const serviceDatesBlock = conceptoValue !== 1 && opts?.fechaServicioDesde && opts?.fechaServicioHasta && opts?.fechaVtoPago
    ? `<ar:FchServDesde>${fmtDate(opts.fechaServicioDesde)}</ar:FchServDesde><ar:FchServHasta>${fmtDate(opts.fechaServicioHasta)}</ar:FchServHasta><ar:FchVtoPago>${fmtDate(opts.fechaVtoPago)}</ar:FchVtoPago>`
    : '';

  console.log(`[ARCA] Concepto: ${conceptoValue}, DocTipo: ${docTipo}, CondIvaReceptor: ${condicionIvaReceptorNumero}`);
  console.log(`[ARCA] ImpTotConc: ${impTotConc}, ImpOpEx: ${impOpEx}, ImpTrib: ${impTrib}`);
  console.log(`[ARCA] IVA block incluido: ${importeIva > 0.005}`);

  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soap:Header/>
  <soap:Body>
    <ar:FECAESolicitar>
      <ar:Auth>
        <ar:Token>${token}</ar:Token>
        <ar:Sign>${sign}</ar:Sign>
        <ar:Cuit>${cuit.replace(/[-]/g, '')}</ar:Cuit>
      </ar:Auth>
      <ar:FeCAEReq>
        <ar:FeCabReq>
          <ar:CantReg>1</ar:CantReg>
          <ar:PtoVta>${puntoVenta}</ar:PtoVta>
          <ar:CbteTipo>${tipoComprobanteCode}</ar:CbteTipo>
        </ar:FeCabReq>
        <ar:FeDetReq>
          <ar:FECAEDetRequest>
            <ar:Concepto>${conceptoValue}</ar:Concepto>
            <ar:DocTipo>${docTipo}</ar:DocTipo>
            <ar:DocNro>${docNro}</ar:DocNro>
            <ar:CbteDesde>${numeroComprobante}</ar:CbteDesde>
            <ar:CbteHasta>${numeroComprobante}</ar:CbteHasta>
            <ar:CbteFch>${fechaComprobante}</ar:CbteFch>
            <ar:ImpTotal>${importeTotal.toFixed(2)}</ar:ImpTotal>
            <ar:ImpTotConc>${impTotConc}</ar:ImpTotConc>
            <ar:ImpNeto>${importeNeto.toFixed(2)}</ar:ImpNeto>
            <ar:ImpOpEx>${impOpEx}</ar:ImpOpEx>
            <ar:ImpIVA>${importeIva.toFixed(2)}</ar:ImpIVA>
            <ar:ImpTrib>${impTrib}</ar:ImpTrib>${serviceDatesBlock}
            <ar:MonId>PES</ar:MonId>
            <ar:MonCotiz>1</ar:MonCotiz><ar:CondicionIvaReceptorId>${condicionIvaReceptorNumero}</ar:CondicionIvaReceptorId>${ivaBlock}
          </ar:FECAEDetRequest>
        </ar:FeDetReq>
      </ar:FeCAEReq>
    </ar:FECAESolicitar>
  </soap:Body>
</soap:Envelope>`;

  console.log('[ARCA] Llamando WSFEv1 FECAESolicitar:', wsfeUrl);

  const response = await fetch(wsfeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECAESolicitar',
    },
    body: soapBody,
  });

  const responseText = await response.text();
  console.log('[ARCA] WSFEv1 Response status:', response.status);
  console.log('[ARCA] WSFEv1 Response body:', responseText.substring(0, 3000));

  if (!response.ok) {
    throw new Error(`WSFEv1 HTTP error ${response.status}: ${responseText.substring(0, 500)}`);
  }

  // Check for SOAP fault
  const faultMatch = responseText.match(/<faultstring>([\s\S]*?)<\/faultstring>/i);
  if (faultMatch) {
    throw new Error(`WSFEv1 SOAP Fault: ${faultMatch[1]}`);
  }

  // Check for AFIP errors
  const errorsMatch = responseText.match(/<Errors>([\s\S]*?)<\/Errors>/i);
  if (errorsMatch) {
    const codeMatch = errorsMatch[1].match(/<Code>([\s\S]*?)<\/Code>/i);
    const msgMatch  = errorsMatch[1].match(/<Msg>([\s\S]*?)<\/Msg>/i);
    if (codeMatch || msgMatch) {
      throw new Error(`AFIP Error ${codeMatch?.[1] || ''}: ${msgMatch?.[1] || errorsMatch[1]}`);
    }
  }

  // Check Resultado
  const resultadoMatch = responseText.match(/<Resultado>([\s\S]*?)<\/Resultado>/i);
  if (resultadoMatch && resultadoMatch[1].trim() === 'R') {
    // Rejected - get observations
    const obsMatch = responseText.match(/<Obs>([\s\S]*?)<\/Obs>/i);
    const obsMsgMatch = obsMatch ? obsMatch[1].match(/<Msg>([\s\S]*?)<\/Msg>/i) : null;
    throw new Error(`AFIP rechazó el comprobante: ${obsMsgMatch?.[1] || obsMatch?.[1] || 'Sin detalle'}`);
  }

  // Extract CAE and expiration
  const caeMatch    = responseText.match(/<CAE>([\s\S]*?)<\/CAE>/i);
  const caeFchMatch = responseText.match(/<CAEFchVto>([\s\S]*?)<\/CAEFchVto>/i);

  if (!caeMatch) {
    throw new Error(`WSFEv1: No se pudo extraer CAE. Respuesta: ${responseText.substring(0, 500)}`);
  }

  const cae = caeMatch[1].trim();
  const caeFchRaw = caeFchMatch?.[1].trim() || '';
  
  // Convert AFIP date format YYYYMMDD to YYYY-MM-DD
  const caeVencimiento = caeFchRaw.length === 8
    ? `${caeFchRaw.slice(0,4)}-${caeFchRaw.slice(4,6)}-${caeFchRaw.slice(6,8)}`
    : caeFchRaw;

  return { cae, caeVencimiento };
}

// ─────────────────────────────────────────────
// Main emitirFacturaARCA – sandbox + production
// ─────────────────────────────────────────────

async function emitirFacturaARCA(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  tenantId: string,
  config: ARCAConfig,
  environment: 'sandbox' | 'production',
  tipoComprobante: 'A' | 'B' | 'C',
  numeroComprobante: number,
  receptor: FacturaRequest['receptor'],
  importeNeto: number,
  importeIva: number,
  importeTotal: number,
  preloadedToken?: string,
  preloadedSign?: string,
  soapOpts?: {
    concepto?: number;
    tipoDocumento?: number;
    fechaServicioDesde?: string;
    fechaServicioHasta?: string;
    fechaVtoPago?: string;
    importeNoGravado?: number;
    importeExento?: number;
    importeTributos?: number;
  },
): Promise<{ success: boolean; cae?: string; caeVencimiento?: string; error?: string; sessionConflict?: boolean }> {
  const endpoints = ARCA_ENDPOINTS[environment];

  try {
    let token: string;
    let sign: string;

    if (preloadedToken && preloadedSign) {
      token = preloadedToken;
      sign = preloadedSign;
      console.log('[ARCA] Reutilizando token WSAA ya obtenido para FECAESolicitar');
    } else {
      console.log(`[ARCA] Obteniendo token WSAA ${environment} (con caché)...`);
      const result = await getWSAAToken(supabase, tenantId, environment, config);
      token = result.token;
      sign = result.sign;
      console.log('[ARCA] WSAA OK – token listo, solicitando CAE...');
    }

    const { cae, caeVencimiento } = await solicitarCAE(
      token, sign, config.cuit, parseInt(config.punto_venta),
      tipoComprobante, numeroComprobante, receptor,
      importeNeto, importeIva, importeTotal, endpoints.wsfe, soapOpts
    );

    console.log(`[ARCA] CAE obtenido: ${cae}, vence: ${caeVencimiento}`);
    return { success: true, cae, caeVencimiento };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ARCA] Error en ${environment}:`, msg);
    // Detectar conflicto de sesión (coe.alreadyAuthenticated sin token cacheado)
    if (msg.startsWith('ARCA_SESSION_CONFLICT:')) {
      return { success: false, sessionConflict: true, error: msg.replace('ARCA_SESSION_CONFLICT: ', '') };
    }
    return { success: false, error: msg };
  }
}

// ─────────────────────────────────────────────
// Database helpers
// ─────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function getARCAConfig(supabase: any, tenantId: string, environment: 'sandbox' | 'production'): Promise<ARCAConfig | null> {
  const { data, error } = await supabase
    .from('system_integrations')
    .select('config_key, config_value')
    .eq('integration_type', 'arca')
    .eq('environment', environment)
    .eq('is_active', true)
    .eq('tenant_id', tenantId);

  if (error || !data || data.length === 0) return null;

  const configMap: Record<string, string> = {};
  // deno-lint-ignore no-explicit-any
  data.forEach((item: any) => { configMap[item.config_key] = item.config_value; });

  if (!configMap.cuit || !configMap.cert_pem || !configMap.private_key || !configMap.punto_venta) {
    return null;
  }

  return {
    cuit: configMap.cuit,
    cert_pem: configMap.cert_pem,
    private_key: configMap.private_key,
    punto_venta: configMap.punto_venta,
  };
}

// ─────────────────────────────────────────────
// WSFEv1 – FECompUltimoAutorizado
// Consulta a AFIP el último número de comprobante emitido para sincronizar el contador local.
// ─────────────────────────────────────────────

async function getUltimoComprobanteAFIP(
  token: string,
  sign: string,
  cuit: string,
  puntoVenta: number,
  tipoComprobante: 'A' | 'B' | 'C',
  wsfeUrl: string
): Promise<number> {
  const tipoCode = INVOICE_CODES[tipoComprobante].factura;

  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soap:Header/>
  <soap:Body>
    <ar:FECompUltimoAutorizado>
      <ar:Auth>
        <ar:Token>${token}</ar:Token>
        <ar:Sign>${sign}</ar:Sign>
        <ar:Cuit>${cuit.replace(/[-]/g, '')}</ar:Cuit>
      </ar:Auth>
      <ar:PtoVta>${puntoVenta}</ar:PtoVta>
      <ar:CbteTipo>${tipoCode}</ar:CbteTipo>
    </ar:FECompUltimoAutorizado>
  </soap:Body>
</soap:Envelope>`;

  try {
    const response = await fetch(wsfeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado',
      },
      body: soapBody,
    });

    const responseText = await response.text();
    console.log('[ARCA] FECompUltimoAutorizado response:', responseText.substring(0, 1000));

    // Detectar error 11002: PV de tipo "Factura en Línea" no consultable por WSFEv1
    const errorCodeMatch = responseText.match(/<Code>([\s\S]*?)<\/Code>/i);
    if (errorCodeMatch && errorCodeMatch[1].trim() === '11002') {
      throw new Error(`ARCA_PV_NOT_RECE: El Punto de Venta ${puntoVenta} es de tipo "Factura en Línea" y no es consultable por web service (WSFEv1). Solo los PV tipo RECE son sincronizables. Podés cargar estos comprobantes manualmente.`);
    }

    // Extraer CbteNro de la respuesta
    const cbteNroMatch = responseText.match(/<CbteNro>([\s\S]*?)<\/CbteNro>/i);
    if (cbteNroMatch) {
      const afipLastNumber = parseInt(cbteNroMatch[1].trim(), 10);
      console.log(`[ARCA] AFIP último comprobante autorizado tipo ${tipoComprobante}: ${afipLastNumber}`);
      return isNaN(afipLastNumber) ? 0 : afipLastNumber;
    }

    // Si no hay comprobantes emitidos, AFIP devuelve 0
    return 0;
  } catch (err) {
    // Re-throw ARCA_PV_NOT_RECE so the caller can handle it specifically
    if (err instanceof Error && err.message.startsWith('ARCA_PV_NOT_RECE')) throw err;
    console.warn('[ARCA] Error consultando FECompUltimoAutorizado:', err);
    // Retornar -1 para indicar fallo y que el caller use el contador local como fallback
    return -1;
  }
}

// deno-lint-ignore no-explicit-any
async function getNextInvoiceNumber(
  supabase: any,
  tenantId: string,
  tipo: 'A' | 'B' | 'C',
  puntoVenta: number,
  token: string,
  sign: string,
  cuit: string,
  wsfeUrl: string
): Promise<number> {
  const field = `ultimo_numero_${tipo.toLowerCase()}`;
  const { data, error } = await supabase
    .from('arca_config')
    .select(field)
    .eq('is_active', true)
    .eq('tenant_id', tenantId)
    .single();

  const localNumber = (!error && data) ? (data[field] || 0) : 0;

  // Consultar a AFIP el último número real – AFIP es la fuente de verdad.
  // Si la consulta falla (retorna -1), se usa el local como fallback.
  const afipLastNumber = await getUltimoComprobanteAFIP(token, sign, cuit, puntoVenta, tipo, wsfeUrl);

  let nextNumber: number;
  if (afipLastNumber >= 0) {
    // AFIP respondió correctamente: el próximo es afipNumber + 1 (ignoramos el local desincronizado)
    nextNumber = afipLastNumber + 1;
    if (localNumber !== afipLastNumber) {
      console.log(`[ARCA] Sincronizando numeración tipo ${tipo}: local=${localNumber} → AFIP=${afipLastNumber}, próximo=${nextNumber}`);
    }
  } else {
    // La consulta a AFIP falló: usamos el local como fallback
    nextNumber = localNumber + 1;
    console.warn(`[ARCA] FECompUltimoAutorizado falló, usando contador local. tipo=${tipo}, local=${localNumber}, próximo=${nextNumber}`);
  }

  console.log(`[ARCA] Numeración tipo ${tipo}: local=${localNumber}, AFIP=${afipLastNumber}, próximo=${nextNumber}`);

  return nextNumber;
}

// deno-lint-ignore no-explicit-any
async function updateInvoiceNumber(supabase: any, tenantId: string, tipo: 'A' | 'B' | 'C', numero: number): Promise<void> {
  const field = `ultimo_numero_${tipo.toLowerCase()}`;
  await supabase
    .from('arca_config')
    .update({ [field]: numero, updated_at: new Date().toISOString() })
    .eq('is_active', true)
    .eq('tenant_id', tenantId);
}

// deno-lint-ignore no-explicit-any
async function createFacturaRecord(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  envioId: string | null,
  liquidacionSellerId: string | null,
  tenantId: string,
  tipoComprobante: 'A' | 'B' | 'C',
  puntoVenta: number,
  numeroComprobante: number,
  receptor: FacturaRequest['receptor'],
  importeNeto: number,
  importeIva: number,
  importeTotal: number,
  userId: string | null,
  extra?: {
    concepto?: number;
    tipoDocumento?: number;
    condicionVenta?: string;
    fechaServicioDesde?: string;
    fechaServicioHasta?: string;
    fechaVtoPago?: string;
    importeNoGravado?: number;
    importeExento?: number;
    importeTributos?: number;
    descripcion?: string;
  }
// deno-lint-ignore no-explicit-any
): Promise<any> {
  const insertData: Record<string, unknown> = {
    tenant_id: tenantId,
    tipo_comprobante: tipoComprobante,
    punto_venta: puntoVenta,
    numero_comprobante: numeroComprobante,
    receptor_cuit: receptor.cuit || receptor.dni,
    receptor_nombre: receptor.nombre,
    receptor_condicion_iva: receptor.condicion_iva,
    receptor_domicilio: receptor.domicilio,
    importe_neto: importeNeto,
    importe_iva: importeIva,
    importe_total: importeTotal,
    fecha_emision: (() => {
      const AR_OFFSET = 3 * 60 * 60 * 1000;
      const d = new Date(Date.now() - AR_OFFSET);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
    })(),
    estado: 'pendiente',
    created_by: userId,
    // New AFIP fields
    concepto: extra?.concepto ?? 1,
    tipo_documento: extra?.tipoDocumento ?? 80,
    condicion_venta: extra?.condicionVenta || null,
    fecha_servicio_desde: extra?.fechaServicioDesde || null,
    fecha_servicio_hasta: extra?.fechaServicioHasta || null,
    fecha_vto_pago: extra?.fechaVtoPago || null,
    importe_no_gravado: extra?.importeNoGravado ?? 0,
    importe_exento: extra?.importeExento ?? 0,
    importe_tributos: extra?.importeTributos ?? 0,
    descripcion: extra?.descripcion || null,
  };

  if (envioId) insertData.envio_id = envioId;
  if (liquidacionSellerId) insertData.liquidacion_seller_id = liquidacionSellerId;
  // liquidacion_terciarizado_id is linked after creation via update

  const { data, error } = await supabase.from('facturas').insert(insertData).select().single();
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────
// WSFEv1 – FECompConsultar (consultar comprobante individual)
// ─────────────────────────────────────────────

interface ComprobanteAFIP {
  docTipo: number;
  docNro: string;
  impTotal: number;
  impNeto: number;
  impIVA: number;
  cbteFch: string;
  cae: string;
  caeFchVto: string;
}

async function consultarComprobante(
  token: string,
  sign: string,
  cuit: string,
  puntoVenta: number,
  tipoComprobante: 'A' | 'B' | 'C',
  cbteNro: number,
  wsfeUrl: string
): Promise<ComprobanteAFIP | null> {
  const tipoCode = INVOICE_CODES[tipoComprobante].factura;

  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soap:Header/>
  <soap:Body>
    <ar:FECompConsultar>
      <ar:Auth>
        <ar:Token>${token}</ar:Token>
        <ar:Sign>${sign}</ar:Sign>
        <ar:Cuit>${cuit.replace(/[-]/g, '')}</ar:Cuit>
      </ar:Auth>
      <ar:FeCompConsReq>
        <ar:CbteTipo>${tipoCode}</ar:CbteTipo>
        <ar:CbteNro>${cbteNro}</ar:CbteNro>
        <ar:PtoVta>${puntoVenta}</ar:PtoVta>
      </ar:FeCompConsReq>
    </ar:FECompConsultar>
  </soap:Body>
</soap:Envelope>`;

  const response = await fetch(wsfeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECompConsultar',
    },
    body: soapBody,
  });

  const responseText = await response.text();

  if (!response.ok) return null;

  // Check for errors
  const errorsMatch = responseText.match(/<Errors>([\s\S]*?)<\/Errors>/i);
  if (errorsMatch) return null;

  // Extract fields
  const extract = (tag: string) => {
    const m = responseText.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return m ? m[1].trim() : '';
  };

  const cae = extract('CAE');
  if (!cae) return null;

  const rawFch = extract('CbteFch');
  const cbteFch = rawFch.length === 8
    ? `${rawFch.slice(0,4)}-${rawFch.slice(4,6)}-${rawFch.slice(6,8)}`
    : rawFch;

  const rawVto = extract('CAEFchVto');
  const caeFchVto = rawVto.length === 8
    ? `${rawVto.slice(0,4)}-${rawVto.slice(4,6)}-${rawVto.slice(6,8)}`
    : rawVto;

  return {
    docTipo: parseInt(extract('DocTipo')) || 99,
    docNro: extract('DocNro'),
    impTotal: parseFloat(extract('ImpTotal')) || 0,
    impNeto: parseFloat(extract('ImpNeto')) || 0,
    impIVA: parseFloat(extract('ImpIVA')) || 0,
    cbteFch,
    cae,
    caeFchVto,
  };
}

// ─────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let tenantId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;

      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('user_id', userId)
          .single();
        tenantId = profile?.tenant_id || null;
      }
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuario no tiene empresa asignada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawBody = await req.json();

    // ── TEST DE CONEXIÓN WSAA ──────────────────────────────────────────────────
    if (rawBody.action === 'test_connection') {
      const testEnv: 'sandbox' | 'production' = rawBody.environment || 'production';
      const arcaTestConfig = await getARCAConfig(supabase, tenantId, testEnv);

      if (!arcaTestConfig) {
        return new Response(
          JSON.stringify({
            success: false,
            environment: testEnv,
            error: `No hay configuración ARCA activa para el entorno ${testEnv === 'production' ? 'Producción' : 'Sandbox'}.`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const testEndpoints = ARCA_ENDPOINTS[testEnv];
      try {
        const { token, sign } = await getWSAAToken(supabase, tenantId, testEnv, arcaTestConfig);
        return new Response(
          JSON.stringify({
            success: true,
            environment: testEnv,
            wsaa_url: testEndpoints.wsaa,
            token_preview: token.substring(0, 40) + '...',
            sign_preview: sign.substring(0, 40) + '...',
            message: 'Autenticación WSAA exitosa. Los certificados son válidos.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({
            success: false,
            environment: testEnv,
            wsaa_url: testEndpoints.wsaa,
            error: err instanceof Error ? err.message : String(err),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    // ── FIN TEST DE CONEXIÓN ──────────────────────────────────────────────────

    // ── SINCRONIZACIÓN DESDE AFIP ─────────────────────────────────────────────
    if (rawBody.action === 'sync_from_afip') {
      const syncEnv: 'sandbox' | 'production' = rawBody.environment || 'production';
      // Accept single `tipo` or array `tipos`
      let syncTypes: ('A' | 'B' | 'C')[];
      if (rawBody.tipo) {
        syncTypes = [rawBody.tipo as 'A' | 'B' | 'C'];
      } else {
        syncTypes = rawBody.tipos || ['A', 'B', 'C'];
      }
      const desdeNumero: number | undefined = rawBody.desde_numero ? parseInt(String(rawBody.desde_numero)) : undefined;
      const MAX_PER_RUN = 30;

      const arcaSyncConfig = await getARCAConfig(supabase, tenantId, syncEnv);
      if (!arcaSyncConfig) {
        return new Response(
          JSON.stringify({ success: false, error: 'ARCA no configurado para este entorno' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const endpoints = ARCA_ENDPOINTS[syncEnv];
      const { token, sign } = await getWSAAToken(supabase, tenantId, syncEnv, arcaSyncConfig);
      const puntoVenta = rawBody.punto_venta ? parseInt(String(rawBody.punto_venta)) : parseInt(arcaSyncConfig.punto_venta);
      let totalImported = 0;
      let totalPending = 0;
      const errors: string[] = [];
      const detailByType: Record<string, { imported: number; total: number; lastAfip: number }> = {};

      for (const tipo of syncTypes) {
        try {
          const afipLast = await getUltimoComprobanteAFIP(token, sign, arcaSyncConfig.cuit, puntoVenta, tipo, endpoints.wsfe);
          if (afipLast <= 0) {
            detailByType[tipo] = { imported: 0, total: 0, lastAfip: 0 };
            continue;
          }

          // Get existing invoice numbers in local DB for this type
          const { data: existingFacturas } = await supabase
            .from('facturas')
            .select('numero_comprobante')
            .eq('tenant_id', tenantId)
            .eq('tipo_comprobante', tipo)
            .eq('punto_venta', puntoVenta);

          const existingNumbers = new Set((existingFacturas || []).map((f: { numero_comprobante: number }) => f.numero_comprobante));

          // Build list of missing numbers
          const startFrom = desdeNumero || Math.max(1, afipLast - 299);
          const missingNumbers: number[] = [];
          for (let nro = startFrom; nro <= afipLast; nro++) {
            if (!existingNumbers.has(nro)) missingNumbers.push(nro);
          }

          const totalMissing = missingNumbers.length;
          const batch = missingNumbers.slice(0, MAX_PER_RUN);
          let importedThisType = 0;

          console.log(`[ARCA] Tipo ${tipo} PV${puntoVenta}: ${totalMissing} faltantes, procesando ${batch.length}`);

          for (let i = 0; i < batch.length; i++) {
            const nro = batch[i];
            try {
              console.log(`[ARCA] Importando tipo ${tipo} #${nro} (${i + 1}/${batch.length})...`);
              const comprobante = await consultarComprobante(token, sign, arcaSyncConfig.cuit, puntoVenta, tipo, nro, endpoints.wsfe);
              if (!comprobante) continue;

              await supabase.from('facturas').insert({
                tenant_id: tenantId,
                tipo_comprobante: tipo,
                punto_venta: puntoVenta,
                numero_comprobante: nro,
                receptor_cuit: comprobante.docNro !== '0' ? comprobante.docNro : null,
                receptor_nombre: 'Importado desde AFIP',
                receptor_condicion_iva: comprobante.docTipo === 80 ? 'responsable_inscripto' : 'consumidor_final',
                importe_neto: comprobante.impNeto,
                importe_iva: comprobante.impIVA,
                importe_total: comprobante.impTotal,
                fecha_emision: comprobante.cbteFch,
                cae: comprobante.cae,
                cae_vencimiento: comprobante.caeFchVto,
                estado: 'emitida',
                importada: true,
                created_by: userId,
              });

              importedThisType++;
              totalImported++;
            } catch (compErr) {
              console.warn(`[ARCA] Error consultando comprobante ${tipo} #${nro}:`, compErr);
            }
          }

          const remainingThisType = totalMissing - importedThisType;
          totalPending += remainingThisType;
          detailByType[tipo] = { imported: importedThisType, total: totalMissing, lastAfip: afipLast };

          // Update local counter
          await updateInvoiceNumber(supabase, tenantId, tipo, afipLast);
        } catch (tipoErr) {
          const errMsg = tipoErr instanceof Error ? tipoErr.message : String(tipoErr);
          if (errMsg.startsWith('ARCA_PV_NOT_RECE')) {
            errors.push(errMsg);
          } else {
            errors.push(`Tipo ${tipo}: ${errMsg}`);
          }
        }
      }

      const pendingMsg = totalPending > 0 ? ` Quedan ${totalPending} pendientes, ejecutá de nuevo para continuar.` : '';
      return new Response(
        JSON.stringify({
          success: true,
          imported: totalImported,
          pending: totalPending,
          detail: detailByType,
          errors: errors.length > 0 ? errors : undefined,
          message: `Se importaron ${totalImported} comprobante(s) desde AFIP.${pendingMsg}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // ── FIN SINCRONIZACIÓN ────────────────────────────────────────────────────

    // ── EMISIÓN DE NOTA DE CRÉDITO ────────────────────────────────────────────
    if (rawBody.action === 'emitir_nota_credito') {
      const ncEnv: 'sandbox' | 'production' = rawBody.environment || 'production';
      const facturaOrigenId = rawBody.factura_origen_id as string | undefined;
      const motivo = (rawBody.motivo as string | undefined) || '';
      const importeTotalNC = Number(rawBody.importe_total) || 0;
      const isTotal = !!rawBody.total;

      if (!facturaOrigenId || importeTotalNC <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Faltan datos: factura_origen_id e importe_total' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Cargar factura origen
      const { data: facturaOrigen, error: foErr } = await supabase
        .from('facturas')
        .select('*')
        .eq('id', facturaOrigenId)
        .eq('tenant_id', tenantId)
        .single();

      if (foErr || !facturaOrigen) {
        return new Response(
          JSON.stringify({ success: false, error: 'Factura origen no encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!facturaOrigen.cae) {
        return new Response(
          JSON.stringify({ success: false, error: 'La factura origen no tiene CAE; debe anularse en lugar de emitir NC' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tipoLetra = (facturaOrigen.tipo_comprobante as 'A' | 'B' | 'C') || 'B';
      const ncTipoCode = INVOICE_CODES[tipoLetra].notaCredito; // 3, 8 o 13

      const ncTotal = Math.round(importeTotalNC * 100) / 100;
      const ncNeto = Math.round((ncTotal / 1.21) * 100) / 100;
      const ncIva = Math.round((ncTotal - ncNeto) * 100) / 100;

      const arcaConfig = await getARCAConfig(supabase, tenantId, ncEnv);
      if (!arcaConfig) {
        return new Response(
          JSON.stringify({ success: false, error: `No hay configuración ARCA para ${ncEnv}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const puntoVenta = parseInt(arcaConfig.punto_venta);
      const endpointsNC = ARCA_ENDPOINTS[ncEnv];

      try {
        const { token, sign } = await getWSAAToken(supabase, tenantId, ncEnv, arcaConfig);

        // Próximo número de NC para este PV+tipo
        const nextNCNumber = await getUltimoComprobanteAFIP(token, sign, arcaConfig.cuit, puntoVenta, tipoLetra, endpointsNC.wsfe);
        // Reusar getUltimoComprobanteAFIP devuelve último de FACTURA, no NC. Necesitamos consulta específica para NC.
        const nextNC = await getUltimoNCAFIP(token, sign, arcaConfig.cuit, puntoVenta, ncTipoCode, endpointsNC.wsfe);
        const nroNC = (nextNC >= 0 ? nextNC : 0) + 1;

        // Receptor: tomar de la factura origen
        const receptorNC = {
          cuit: facturaOrigen.receptor_cuit || undefined,
          nombre: facturaOrigen.receptor_nombre || 'Sin datos',
          condicion_iva: facturaOrigen.receptor_condicion_iva || 'consumidor_final',
          domicilio: facturaOrigen.receptor_domicilio || undefined,
        };

        // Solicitar CAE para NC con CbtesAsoc apuntando a la factura origen
        const caeResult = await solicitarCAENotaCredito(
          token, sign, arcaConfig.cuit, puntoVenta, ncTipoCode, nroNC,
          receptorNC, ncNeto, ncIva, ncTotal,
          {
            origen_tipo: INVOICE_CODES[tipoLetra].factura,
            origen_pv: facturaOrigen.punto_venta,
            origen_nro: facturaOrigen.numero_comprobante,
            origen_cuit: arcaConfig.cuit,
            origen_fecha: facturaOrigen.fecha_emision,
          },
          endpointsNC.wsfe
        );

        // Persistir NC en facturas
        const { data: ncRecord, error: insErr } = await supabase.from('facturas').insert({
          tenant_id: tenantId,
          tipo_comprobante: tipoLetra, // mantenemos letra; flag es_nota_credito diferencia
          punto_venta: puntoVenta,
          numero_comprobante: nroNC,
          fecha_emision: new Date().toISOString(),
          receptor_cuit: receptorNC.cuit,
          receptor_nombre: receptorNC.nombre,
          receptor_condicion_iva: receptorNC.condicion_iva,
          receptor_domicilio: receptorNC.domicilio,
          importe_neto: ncNeto,
          importe_iva: ncIva,
          importe_total: ncTotal,
          cae: caeResult.cae,
          cae_vencimiento: caeResult.caeVencimiento,
          estado: 'emitida',
          es_nota_credito: true,
          factura_origen_id: facturaOrigenId,
          motivo_nota_credito: motivo,
          created_by: userId,
          arca_response: { ...caeResult, environment: ncEnv, cbte_tipo: ncTipoCode },
        }).select().single();

        if (insErr) throw insErr;

        // Si NC total → marcar factura origen como anulada_por_nc
        if (isTotal) {
          await supabase.from('facturas').update({
            estado: 'anulada_por_nc',
            anulada_at: new Date().toISOString(),
            anulada_por: userId,
            motivo_anulacion: motivo || 'Anulada por Nota de Crédito',
          }).eq('id', facturaOrigenId);
        }

        return new Response(
          JSON.stringify({
            success: true,
            nota_credito_id: ncRecord.id,
            cae: caeResult.cae,
            cae_vencimiento: caeResult.caeVencimiento,
            numero_comprobante: `${String(puntoVenta).padStart(4,'0')}-${String(nroNC).padStart(8,'0')}`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[ARCA NC] Error:', msg);
        return new Response(
          JSON.stringify({ success: false, error: msg }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    // ── FIN NOTA DE CRÉDITO ───────────────────────────────────────────────────

    const body: FacturaRequest = rawBody;
    const { envio_id, liquidacion_seller_id, liquidacion_terciarizado_id, tipo_comprobante, receptor, importe_total } = body;
    const requestedEnv: 'sandbox' | 'production' = body.environment || 'production';

    if (!envio_id && !liquidacion_seller_id && !liquidacion_terciarizado_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Se requiere envio_id, liquidacion_seller_id o liquidacion_terciarizado_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tipo_comprobante || !receptor) {
      return new Response(
        JSON.stringify({ success: false, error: 'Faltan campos requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (tipo_comprobante === 'A' && !receptor.cuit) {
      return new Response(
        JSON.stringify({ success: false, error: 'Factura A requiere CUIT del receptor' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let total: number;

    if (liquidacion_seller_id) {
      const { data: liquidacion, error: liqError } = await supabase
        .from('liquidaciones_seller')
        .select('*')
        .eq('id', liquidacion_seller_id)
        .single();

      if (liqError || !liquidacion) {
        return new Response(
          JSON.stringify({ success: false, error: 'Liquidación de seller no encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      total = importe_total ?? Math.abs(liquidacion.saldo_periodo || 0);
    } else if (liquidacion_terciarizado_id) {
      const { data: liquidacion, error: liqError } = await supabase
        .from('liquidaciones_terciarizado')
        .select('*')
        .eq('id', liquidacion_terciarizado_id)
        .single();

      if (liqError || !liquidacion) {
        return new Response(
          JSON.stringify({ success: false, error: 'Liquidación de terciarizado no encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      total = importe_total ?? liquidacion.monto_total;
    } else {
      const { data: envio, error: envioError } = await supabase
        .from('envios')
        .select('*')
        .eq('id', envio_id)
        .eq('tenant_id', tenantId)
        .single();

      if (envioError || !envio) {
        return new Response(
          JSON.stringify({ success: false, error: 'Envío no encontrado o no pertenece a tu empresa' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      total = importe_total ?? envio.precio_total;
    }

    // ── Desglose fiscal ──────────────────────────────────────────────
    // CORRECCIÓN Bug 1: Calcular importeNeto e importeIva con precisión garantizada.
    // total = precio con IVA incluido (21%).
    // Para Factura A: receptor es RI, se factura con IVA discriminado.
    // Para Factura B/C: consumidores finales o monotributistas, IVA incluido.
    // AFIP exige siempre el desglose aunque el receptor sea CF.
    const importeTotal = Math.round(total * 100) / 100;
    const importeNeto  = Math.round((importeTotal / 1.21) * 100) / 100;
    const importeIva   = Math.round((importeTotal - importeNeto) * 100) / 100;

    console.log(`[ARCA] Desglose fiscal: total=${importeTotal}, neto=${importeNeto}, iva=${importeIva}`);
    // Validar coherencia (AFIP rechaza si no cuadra)
    if (Math.abs(importeNeto + importeIva - importeTotal) > 0.02) {
      console.error('[ARCA] WARN: Discrepancia en desglose IVA', { importeTotal, importeNeto, importeIva });
    }

    // Use exactly the requested environment – no silent fallback
    const environment = requestedEnv;
    const arcaConfig = await getARCAConfig(supabase, tenantId, environment);

    // No config for requested environment
    if (!arcaConfig) {
      // Check if the other environment is configured so we can give a helpful message
      const otherEnv = environment === 'production' ? 'sandbox' : 'production';
      const otherConfig = await getARCAConfig(supabase, tenantId, otherEnv);

      if (otherConfig) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `No hay configuración ARCA para el entorno ${environment === 'production' ? 'producción' : 'sandbox'}. Hay configuración disponible para ${otherEnv === 'production' ? 'producción' : 'sandbox'}.`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // No config in either environment → save as pending
      const factura = await createFacturaRecord(
        supabase, envio_id || null, liquidacion_seller_id || null, tenantId,
        tipo_comprobante, 0, 0, receptor, importeNeto, importeIva, importeTotal, userId
      );

      if (envio_id) {
        await supabase.from('envios')
          .update({ requiere_factura: true, updated_at: new Date().toISOString() })
          .eq('id', envio_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          factura_id: factura.id,
          estado: 'pendiente',
          message: 'Factura guardada para procesamiento manual. Configure ARCA para emisión automática.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const puntoVenta = parseInt(arcaConfig.punto_venta);

    // Obtener token WSAA primero para poder consultar FECompUltimoAutorizado
    const endpoints = ARCA_ENDPOINTS[environment];
    const { token: wsaaToken, sign: wsaaSign } = await getWSAAToken(supabase, tenantId, environment, arcaConfig);

    // Obtener el próximo número sincronizado con AFIP
    const numeroComprobante = await getNextInvoiceNumber(
      supabase, tenantId, tipo_comprobante, puntoVenta,
      wsaaToken, wsaaSign, arcaConfig.cuit, endpoints.wsfe
    );

    const factura = await createFacturaRecord(
      supabase, envio_id || null, liquidacion_seller_id || null, tenantId,
      tipo_comprobante, puntoVenta, numeroComprobante, receptor,
      importeNeto, importeIva, importeTotal, userId
    );

    const arcaResult = await emitirFacturaARCA(
      supabase, tenantId, arcaConfig, environment, tipo_comprobante, numeroComprobante,
      receptor, importeNeto, importeIva, importeTotal,
      wsaaToken, wsaaSign  // reusar el token ya obtenido, evita doble auth
    );

    if (arcaResult.success && arcaResult.cae) {
      // Persistir environment y fecha_comprobante en arca_response para trazabilidad
      const enrichedArcaResponse = {
        ...arcaResult,
        environment,
        fecha_comprobante: (() => {
          const AR_OFFSET = 3 * 60 * 60 * 1000;
          const d = new Date(Date.now() - AR_OFFSET);
          return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
        })(),
      };
      await supabase.from('facturas').update({
        cae: arcaResult.cae,
        cae_vencimiento: arcaResult.caeVencimiento,
        estado: 'emitida',
        arca_response: enrichedArcaResponse,
      }).eq('id', factura.id);

      if (envio_id) {
        await supabase.from('envios').update({
          factura_cae: arcaResult.cae,
          factura_numero: `${String(puntoVenta).padStart(4, '0')}-${String(numeroComprobante).padStart(8, '0')}`,
          factura_tipo: tipo_comprobante,
          factura_fecha: new Date().toISOString(),
          requiere_factura: false,
          updated_at: new Date().toISOString(),
        }).eq('id', envio_id);
      }

      if (liquidacion_seller_id) {
        await supabase.from('liquidaciones_seller').update({
          factura_id: factura.id,
          updated_at: new Date().toISOString(),
        }).eq('id', liquidacion_seller_id);
      }

      if (liquidacion_terciarizado_id) {
        await supabase.from('liquidaciones_terciarizado').update({
          factura_id: factura.id,
        }).eq('id', liquidacion_terciarizado_id);

        // Also link in facturas table
        await supabase.from('facturas').update({
          liquidacion_terciarizado_id: liquidacion_terciarizado_id,
        }).eq('id', factura.id);
      }

      await updateInvoiceNumber(supabase, tenantId, tipo_comprobante, numeroComprobante);

      return new Response(
        JSON.stringify({
          success: true,
          factura_id: factura.id,
          estado: 'emitida',
          cae: arcaResult.cae,
          cae_vencimiento: arcaResult.caeVencimiento,
          numero_comprobante: `${String(puntoVenta).padStart(4, '0')}-${String(numeroComprobante).padStart(8, '0')}`,
          environment,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (arcaResult.sessionConflict) {
      // Conflicto de sesión AFIP – NO es un rechazo real. Guardar como pendiente para reintento.
      await supabase.from('facturas').update({
        estado: 'pendiente',
        error_mensaje: arcaResult.error,
      }).eq('id', factura.id);

      return new Response(
        JSON.stringify({
          success: true,
          factura_id: factura.id,
          estado: 'pendiente',
          message: 'Sesión AFIP activa sin token local. La factura quedó pendiente para reintento automático. Reintente en unos minutos o espere hasta 12 horas.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      await supabase.from('facturas').update({
        estado: 'rechazada',
        error_mensaje: arcaResult.error,
        arca_response: arcaResult,
      }).eq('id', factura.id);

      return new Response(
        JSON.stringify({
          success: false,
          factura_id: factura.id,
          estado: 'rechazada',
          error: arcaResult.error,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[ARCA] Error general:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    // Session conflict is recoverable — return 200 with fallback flag so frontend doesn't crash
    const isSessionConflict = errorMessage.includes('ARCA_SESSION_CONFLICT');
    const statusCode = isSessionConflict ? 200 : 500;
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, fallback: isSessionConflict }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

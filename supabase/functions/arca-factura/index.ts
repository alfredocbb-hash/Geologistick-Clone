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
  tipo_comprobante: 'A' | 'B' | 'C';
  environment?: 'sandbox' | 'production';
  receptor: {
    cuit?: string;
    dni?: string;
    nombre: string;
    condicion_iva: string;
    domicilio?: string;
  };
  conceptos?: Array<{
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
  }>;
  importe_total?: number;
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
  wsfeUrl: string
): Promise<{ cae: string; caeVencimiento: string }> {
  const tipoComprobanteCode = INVOICE_CODES[tipoComprobante].factura;
  const ivaCondition = IVA_CONDITIONS[receptor.condicion_iva] || IVA_CONDITIONS.consumidor_final;
  
  const docTipo = ivaCondition.docTipo;
  // RG AFIP: cuando DocTipo = 99 (Consumidor Final), DocNro DEBE ser 0
  // para comprobantes B < $10M. El DNI se guarda igual en la tabla facturas.
  const docNro = docTipo === 99
    ? '0'
    : (receptor.cuit?.replace(/[-]/g, '') || receptor.dni || '0');

  const today = new Date();
  const fechaComprobante = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;

  // AFIP requiere el objeto IVA cuando ImpNeto > 0, independientemente del tipo de comprobante (A, B o C)
  // Para tipo A: alícuota 21% (Id=5) con ImpNeto como base
  // Para tipo B y C a Consumidor Final: también se incluye con alícuota 21% (Id=5)
  // Referencia: Error AFIP 10070 "Si ImpNeto es mayor a 0 el objeto IVA es obligatorio"
  const ivaAlicuota = importeNeto > 0 ? `
              <AlicIva>
                <Id>5</Id>
                <BaseImp>${importeNeto.toFixed(2)}</BaseImp>
                <Importe>${importeIva.toFixed(2)}</Importe>
              </AlicIva>` : '';

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
            <ar:Concepto>1</ar:Concepto>
            <ar:DocTipo>${docTipo}</ar:DocTipo>
            <ar:DocNro>${docNro}</ar:DocNro>
            <ar:CbteDesde>${numeroComprobante}</ar:CbteDesde>
            <ar:CbteHasta>${numeroComprobante}</ar:CbteHasta>
            <ar:CbteFch>${fechaComprobante}</ar:CbteFch>
            <ar:ImpTotal>${importeTotal.toFixed(2)}</ar:ImpTotal>
            <ar:ImpTotConc>0.00</ar:ImpTotConc>
            <ar:ImpNeto>${importeNeto.toFixed(2)}</ar:ImpNeto>
            <ar:ImpOpEx>0.00</ar:ImpOpEx>
            <ar:ImpIVA>${importeIva.toFixed(2)}</ar:ImpIVA>
            <ar:ImpTrib>0.00</ar:ImpTrib>
            <ar:MonId>PES</ar:MonId>
            <ar:MonCotiz>1</ar:MonCotiz>${importeNeto > 0 ? `
            <ar:Iva>${ivaAlicuota}
            </ar:Iva>` : ''}
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
  // Token ya obtenido previamente para evitar doble autenticación
  preloadedToken?: string,
  preloadedSign?: string,
): Promise<{ success: boolean; cae?: string; caeVencimiento?: string; error?: string; sessionConflict?: boolean }> {
  const endpoints = ARCA_ENDPOINTS[environment];

  try {
    let token: string;
    let sign: string;

    if (preloadedToken && preloadedSign) {
      // Reusar el token ya obtenido para la consulta de FECompUltimoAutorizado
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
      token,
      sign,
      config.cuit,
      parseInt(config.punto_venta),
      tipoComprobante,
      numeroComprobante,
      receptor,
      importeNeto,
      importeIva,
      importeTotal,
      endpoints.wsfe
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
  userId: string | null
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
    estado: 'pendiente',
    created_by: userId,
  };

  if (envioId) insertData.envio_id = envioId;
  if (liquidacionSellerId) insertData.liquidacion_seller_id = liquidacionSellerId;

  const { data, error } = await supabase.from('facturas').insert(insertData).select().single();
  if (error) throw error;
  return data;
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
        // Usar caché: si hay token vigente, retornarlo sin re-autenticar
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

    const body: FacturaRequest = rawBody;
    const { envio_id, liquidacion_seller_id, tipo_comprobante, receptor, importe_total } = body;
    const requestedEnv: 'sandbox' | 'production' = body.environment || 'production';

    if (!envio_id && !liquidacion_seller_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Se requiere envio_id o liquidacion_seller_id' }),
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
          JSON.stringify({ success: false, error: 'Liquidación no encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      total = importe_total ?? Math.abs(liquidacion.saldo_periodo || 0);
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

    let importeNeto: number;
    let importeIva: number;

    if (tipo_comprobante === 'A') {
      importeNeto = total / 1.21;
      importeIva  = total - importeNeto;
    } else {
      importeNeto = total;
      importeIva  = 0;
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
        tipo_comprobante, 0, 0, receptor, importeNeto, importeIva, total, userId
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
      importeNeto, importeIva, total, userId
    );

    const arcaResult = await emitirFacturaARCA(
      supabase, tenantId, arcaConfig, environment, tipo_comprobante, numeroComprobante,
      receptor, importeNeto, importeIva, total,
      wsaaToken, wsaaSign  // reusar el token ya obtenido, evita doble auth
    );

    if (arcaResult.success && arcaResult.cae) {
      await supabase.from('facturas').update({
        cae: arcaResult.cae,
        cae_vencimiento: arcaResult.caeVencimiento,
        estado: 'emitida',
        arca_response: arcaResult,
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
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ARCA / AFIP – Consulta padrón A13 para autocompletar datos a partir de CUIT
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ENDPOINTS = {
  sandbox: {
    wsaa: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
    padron: "https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA13",
  },
  production: {
    wsaa: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
    padron: "https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA13",
  },
} as const;

// ─── DER / ASN.1 helpers ───
function derLength(len: number): Uint8Array {
  if (len < 128) return new Uint8Array([len]);
  if (len < 256) return new Uint8Array([0x81, len]);
  return new Uint8Array([0x82, (len >> 8) & 0xff, len & 0xff]);
}
function derTLV(tag: number, value: Uint8Array): Uint8Array {
  const lenBytes = derLength(value.length);
  const out = new Uint8Array(1 + lenBytes.length + value.length);
  out[0] = tag; out.set(lenBytes, 1); out.set(value, 1 + lenBytes.length);
  return out;
}
function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total); let o = 0;
  for (const a of arrays) { out.set(a, o); o += a.length; }
  return out;
}
const derSequence = (...x: Uint8Array[]) => derTLV(0x30, concat(...x));
const derSet = (...x: Uint8Array[]) => derTLV(0x31, concat(...x));
function derOID(oid: number[]): Uint8Array {
  const enc: number[] = [40 * oid[0] + oid[1]];
  for (let i = 2; i < oid.length; i++) {
    let v = oid[i]; const parts: number[] = [v & 0x7f]; v >>= 7;
    while (v > 0) { parts.unshift((v & 0x7f) | 0x80); v >>= 7; }
    enc.push(...parts);
  }
  return derTLV(0x06, new Uint8Array(enc));
}
function derInteger(b: Uint8Array, pos = true): Uint8Array {
  let v = b; if (pos && b[0] & 0x80) v = concat(new Uint8Array([0]), b);
  return derTLV(0x02, v);
}
const derOctetString = (b: Uint8Array) => derTLV(0x04, b);
const derContextImplicit = (tag: number, c: Uint8Array) => derTLV(0xa0 + tag, c);

function pemToDer(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  return new Uint8Array(bin.length).map((_, i) => bin.charCodeAt(i));
}

function extractSerial(certDer: Uint8Array): Uint8Array {
  let o = 0;
  if (certDer[o++] !== 0x30) throw new Error("bad cert");
  o += certDer[o] < 128 ? 1 : (certDer[o] & 0x7f) + 1;
  if (certDer[o++] !== 0x30) throw new Error("bad tbs");
  o += certDer[o] < 128 ? 1 : (certDer[o] & 0x7f) + 1;
  if (certDer[o] === 0xa0) { o++; const l = certDer[o++]; o += l; }
  if (certDer[o++] !== 0x02) throw new Error("bad serial");
  const sLen = certDer[o++];
  return certDer.slice(o, o + sLen);
}
function extractIssuer(certDer: Uint8Array): Uint8Array {
  let o = 0;
  if (certDer[o++] !== 0x30) throw new Error("bad cert");
  o += certDer[o] < 128 ? 1 : (certDer[o] & 0x7f) + 1;
  if (certDer[o++] !== 0x30) throw new Error("bad tbs");
  o += certDer[o] < 128 ? 1 : (certDer[o] & 0x7f) + 1;
  if (certDer[o] === 0xa0) { o++; const l = certDer[o++]; o += l; }
  if (certDer[o++] !== 0x02) throw new Error("bad serial");
  const sLen = certDer[o++]; o += sLen;
  if (certDer[o++] !== 0x30) throw new Error("bad alg");
  let algLen: number;
  if (certDer[o] < 128) { algLen = certDer[o++]; }
  else { const n = certDer[o++] & 0x7f; algLen = 0; for (let i = 0; i < n; i++) algLen = (algLen << 8) | certDer[o++]; }
  o += algLen;
  const iStart = o;
  if (certDer[o++] !== 0x30) throw new Error("bad issuer");
  let iLen: number;
  if (certDer[o] < 128) { iLen = certDer[o++]; }
  else { const n = certDer[o++] & 0x7f; iLen = 0; for (let i = 0; i < n; i++) iLen = (iLen << 8) | certDer[o++]; }
  o += iLen;
  return certDer.slice(iStart, o);
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "pkcs8", pemToDer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"],
  );
}

async function buildCMS(content: Uint8Array, certPem: string, keyPem: string): Promise<Uint8Array> {
  const certDer = pemToDer(certPem);
  const key = await importPrivateKey(keyPem);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, key, content));
  const oidData = derOID([1, 2, 840, 113549, 1, 7, 1]);
  const oidSigned = derOID([1, 2, 840, 113549, 1, 7, 2]);
  const oidSha256 = derSequence(derOID([2, 16, 840, 1, 101, 3, 4, 2, 1]), derTLV(0x05, new Uint8Array(0)));
  const oidRsa = derSequence(derOID([1, 2, 840, 113549, 1, 1, 1]), derTLV(0x05, new Uint8Array(0)));
  const issuerAndSerial = derSequence(extractIssuer(certDer), derInteger(extractSerial(certDer), false));
  const signedData = derSequence(
    derInteger(new Uint8Array([1])),
    derSet(oidSha256),
    derSequence(oidData, derContextImplicit(0, derOctetString(content))),
    derContextImplicit(0, certDer),
    derSet(derSequence(
      derInteger(new Uint8Array([1])),
      issuerAndSerial,
      oidSha256,
      oidRsa,
      derOctetString(sig),
    )),
  );
  return derSequence(oidSigned, derContextImplicit(0, signedData));
}

function generarTRA(service: string): string {
  const now = new Date();
  const AR = 3 * 60 * 60 * 1000;
  const fmt = (d: Date) => new Date(d.getTime() - AR).toISOString().replace("Z", "-03:00");
  const gen = new Date(now.getTime() - 60_000);
  const exp = new Date(now.getTime() + 600_000);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<loginTicketRequest version="1.0">\n  <header>\n    <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>\n    <generationTime>${fmt(gen)}</generationTime>\n    <expirationTime>${fmt(exp)}</expirationTime>\n  </header>\n  <service>${service}</service>\n</loginTicketRequest>`;
}

function decodeEntities(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

async function authWSAA(certPem: string, keyPem: string, wsaaUrl: string, service: string) {
  const tra = generarTRA(service);
  const cms = await buildCMS(new TextEncoder().encode(tra), certPem, keyPem);
  const cmsB64 = btoa(String.fromCharCode(...cms));
  const env = `<?xml version="1.0" encoding="utf-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov"><soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cmsB64}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`;
  const r = await fetch(wsaaUrl, { method: "POST", headers: { "Content-Type": "text/xml; charset=utf-8", "SOAPAction": "" }, body: env });
  const text = await r.text();
  const decoded = decodeEntities(text);
  const fault = decoded.match(/<faultstring>([\s\S]*?)<\/faultstring>/);
  if (fault) {
    if (decoded.includes("coe.alreadyAuthenticated")) throw new Error("WSAA_ALREADY_AUTHENTICATED");
    throw new Error(`WSAA fault: ${fault[1]}`);
  }
  if (!r.ok) throw new Error(`WSAA HTTP ${r.status}`);
  const tokenM = decoded.match(/<token>([\s\S]*?)<\/token>/);
  const signM = decoded.match(/<sign>([\s\S]*?)<\/sign>/);
  if (!tokenM || !signM) throw new Error("WSAA: token/sign no encontrados");
  return { token: tokenM[1].trim(), sign: signM[1].trim() };
}

// ─── Cache (system_integrations, keys cache_wsaa_padron_*) ───
async function getCached(supabase: any, tenantId: string, env: string) {
  const { data } = await supabase
    .from("system_integrations")
    .select("config_key, config_value")
    .eq("integration_type", "arca").eq("environment", env).eq("tenant_id", tenantId)
    .in("config_key", ["cache_wsaa_padron_token", "cache_wsaa_padron_sign", "cache_wsaa_padron_expires_at"]);
  if (!data || data.length === 0) return null;
  const m: Record<string, string> = {};
  data.forEach((r: any) => { m[r.config_key] = r.config_value; });
  if (!m.cache_wsaa_padron_token || !m.cache_wsaa_padron_sign || !m.cache_wsaa_padron_expires_at) return null;
  if (new Date(m.cache_wsaa_padron_expires_at).getTime() - 5 * 60_000 <= Date.now()) return null;
  return { token: m.cache_wsaa_padron_token, sign: m.cache_wsaa_padron_sign };
}
async function setCached(supabase: any, tenantId: string, env: string, token: string, sign: string) {
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  for (const e of [
    { config_key: "cache_wsaa_padron_token", config_value: token },
    { config_key: "cache_wsaa_padron_sign", config_value: sign },
    { config_key: "cache_wsaa_padron_expires_at", config_value: expiresAt },
  ]) {
    await supabase.from("system_integrations").upsert({
      integration_type: "arca", environment: env, tenant_id: tenantId,
      config_key: e.config_key, config_value: e.config_value, is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,integration_type,config_key,environment" });
  }
}

async function getArcaConfig(supabase: any, tenantId: string, env: string) {
  const { data } = await supabase
    .from("system_integrations")
    .select("config_key, config_value")
    .eq("integration_type", "arca").eq("environment", env).eq("is_active", true).eq("tenant_id", tenantId);
  if (!data || data.length === 0) return null;
  const m: Record<string, string> = {};
  data.forEach((r: any) => { m[r.config_key] = r.config_value; });
  if (!m.cuit || !m.cert_pem || !m.private_key) return null;
  return { cuit: m.cuit.replace(/\D/g, ""), cert_pem: m.cert_pem, private_key: m.private_key };
}

// ─── Padron A13 SOAP ───
async function consultarPadron(token: string, sign: string, cuitRep: string, idPersona: string, padronUrl: string) {
  const env = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a13="http://a13.soap.ws.server.puc.sr/">
  <soapenv:Header/>
  <soapenv:Body>
    <a13:getPersona>
      <token>${token}</token>
      <sign>${sign}</sign>
      <cuitRepresentada>${cuitRep}</cuitRepresentada>
      <idPersona>${idPersona}</idPersona>
    </a13:getPersona>
  </soapenv:Body>
</soapenv:Envelope>`;
  const r = await fetch(padronUrl, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", "SOAPAction": "" },
    body: env,
  });
  const text = await r.text();
  if (!r.ok) {
    const fault = text.match(/<faultstring>([\s\S]*?)<\/faultstring>/);
    throw new Error(`Padron HTTP ${r.status}: ${fault ? fault[1] : text.substring(0, 300)}`);
  }
  return text;
}

function pick(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : null;
}

function parsePadron(xml: string) {
  // Detectar persona no encontrada
  if (/<faultstring>[\s\S]*?(no existe|sin datos)/i.test(xml)) {
    return { found: false, reason: "Persona no encontrada en el padrón" };
  }
  const personaBlock = xml.match(/<persona>([\s\S]*?)<\/persona>/);
  if (!personaBlock) return { found: false, reason: "Sin datos en respuesta" };
  const p = personaBlock[1];

  const tipoPersona = pick(p, "tipoPersona"); // FISICA / JURIDICA
  const razonSocial = pick(p, "razonSocial");
  const nombre = pick(p, "nombre");
  const apellido = pick(p, "apellido");
  const estado = pick(p, "estadoClave");
  const idPersona = pick(p, "idPersona");

  // Domicilio fiscal: primero buscar el bloque domicilioFiscal, fallback al primer domicilio
  let dom = p.match(/<domicilioFiscal>([\s\S]*?)<\/domicilioFiscal>/)?.[1];
  if (!dom) dom = p.match(/<domicilio>([\s\S]*?)<\/domicilio>/)?.[1];

  const direccion = dom ? pick(dom, "direccion") : null;
  const localidad = dom ? pick(dom, "localidad") : null;
  const codPostal = dom ? pick(dom, "codPostal") : null;
  const provincia = dom ? pick(dom, "descripcionProvincia") : null;

  // Condición IVA: deducir desde impuestos / categoriasMonotributo
  let condicionIva: string = "consumidor_final";
  const impuestos = [...p.matchAll(/<idImpuesto>(\d+)<\/idImpuesto>/g)].map((m) => m[1]);
  const tieneMonotributo = /<categoriasMonotributo>/i.test(p) || impuestos.includes("20");
  if (tieneMonotributo) condicionIva = "monotributo";
  else if (impuestos.includes("32")) condicionIva = "exento";
  else if (impuestos.includes("30")) condicionIva = "responsable_inscripto";

  const nombreFinal = razonSocial || [apellido, nombre].filter(Boolean).join(", ") || nombre || "";

  return {
    found: true,
    cuit: idPersona,
    razon_social: razonSocial || nombreFinal,
    nombre: nombreFinal,
    tipo_persona: tipoPersona,
    condicion_iva: condicionIva,
    domicilio: direccion,
    ciudad: localidad,
    provincia,
    codigo_postal: codPostal,
    estado,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: claims, error: cErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (cErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub;

    const body = await req.json().catch(() => ({}));
    const cuit = String(body.cuit || "").replace(/\D/g, "");
    if (cuit.length !== 11) {
      return new Response(JSON.stringify({ found: false, reason: "CUIT inválido" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // tenant
    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", userId).maybeSingle();
    const tenantId = profile?.tenant_id;
    if (!tenantId) {
      return new Response(JSON.stringify({ found: false, reason: "Sin tenant" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // determinar environment: el primero activo configurado
    let environment: "sandbox" | "production" = "production";
    let arcaConfig = await getArcaConfig(supabase, tenantId, "production");
    if (!arcaConfig) {
      arcaConfig = await getArcaConfig(supabase, tenantId, "sandbox");
      environment = "sandbox";
    }
    if (!arcaConfig) {
      return new Response(JSON.stringify({ found: false, reason: "ARCA no configurado para este tenant" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ep = ENDPOINTS[environment];
    let creds = await getCached(supabase, tenantId, environment);
    if (!creds) {
      try {
        creds = await authWSAA(arcaConfig.cert_pem, arcaConfig.private_key, ep.wsaa, "ws_sr_padron_a13");
        await setCached(supabase, tenantId, environment, creds.token, creds.sign);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "WSAA_ALREADY_AUTHENTICATED") {
          return new Response(JSON.stringify({ found: false, reason: "AFIP tiene una sesión activa de padrón. Reintentá en unos minutos." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        throw e;
      }
    }

    const xml = await consultarPadron(creds.token, creds.sign, arcaConfig.cuit, cuit, ep.padron);
    const parsed = parsePadron(xml);

    return new Response(JSON.stringify(parsed), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[arca-consultar-padron]", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

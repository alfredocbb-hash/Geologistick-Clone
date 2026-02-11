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

// deno-lint-ignore no-explicit-any
async function getARCAConfig(supabase: any, tenantId: string, environment: 'sandbox' | 'production'): Promise<ARCAConfig | null> {
  const { data, error } = await supabase
    .from('system_integrations')
    .select('config_key, config_value')
    .eq('integration_type', 'arca')
    .eq('environment', environment)
    .eq('is_active', true)
    .eq('tenant_id', tenantId);

  if (error || !data || data.length === 0) {
    return null;
  }

  const configMap: Record<string, string> = {};
  // deno-lint-ignore no-explicit-any
  data.forEach((item: any) => {
    configMap[item.config_key] = item.config_value;
  });

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

// deno-lint-ignore no-explicit-any
async function getNextInvoiceNumber(supabase: any, tenantId: string, tipo: 'A' | 'B' | 'C', _puntoVenta: number): Promise<number> {
  const field = `ultimo_numero_${tipo.toLowerCase()}`;
  
  const { data, error } = await supabase
    .from('arca_config')
    .select(field)
    .eq('is_active', true)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !data) {
    return 1;
  }

  return (data[field] || 0) + 1;
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

  const { data, error } = await supabase
    .from('facturas')
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function emitirFacturaARCA(
  config: ARCAConfig,
  environment: 'sandbox' | 'production',
  tipoComprobante: 'A' | 'B' | 'C',
  numeroComprobante: number,
  receptor: FacturaRequest['receptor'],
  importeNeto: number,
  importeIva: number,
  importeTotal: number
): Promise<{ success: boolean; cae?: string; caeVencimiento?: string; error?: string }> {
  if (environment === 'sandbox') {
    const cae = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const caeVencimiento = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`SANDBOX MODE: Simulating ARCA invoice emission - tipo: ${tipoComprobante}, numero: ${numeroComprobante}`);
    
    return {
      success: true,
      cae,
      caeVencimiento,
    };
  }
  
  return {
    success: false,
    error: 'Integración ARCA en producción requiere certificados configurados',
  };
}

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

    const body: FacturaRequest = await req.json();
    const { envio_id, liquidacion_seller_id, tipo_comprobante, receptor, importe_total } = body;

    // Must have either envio_id or liquidacion_seller_id
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
      // Invoice for a seller settlement
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
      // Invoice for a shipment (original flow)
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
      importeIva = total - importeNeto;
    } else {
      importeNeto = total;
      importeIva = 0;
    }

    let environment: 'sandbox' | 'production' = 'production';
    let arcaConfig = await getARCAConfig(supabase, tenantId, 'production');
    
    if (!arcaConfig) {
      environment = 'sandbox';
      arcaConfig = await getARCAConfig(supabase, tenantId, 'sandbox');
    }

    if (!arcaConfig) {
      const factura = await createFacturaRecord(
        supabase,
        envio_id || null,
        liquidacion_seller_id || null,
        tenantId,
        tipo_comprobante,
        0,
        0,
        receptor,
        importeNeto,
        importeIva,
        total,
        userId
      );

      // Update envio if applicable
      if (envio_id) {
        await supabase
          .from('envios')
          .update({
            requiere_factura: true,
            updated_at: new Date().toISOString(),
          })
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
    const numeroComprobante = await getNextInvoiceNumber(supabase, tenantId, tipo_comprobante, puntoVenta);

    const factura = await createFacturaRecord(
      supabase,
      envio_id || null,
      liquidacion_seller_id || null,
      tenantId,
      tipo_comprobante,
      puntoVenta,
      numeroComprobante,
      receptor,
      importeNeto,
      importeIva,
      total,
      userId
    );

    const arcaResult = await emitirFacturaARCA(
      arcaConfig,
      environment,
      tipo_comprobante,
      numeroComprobante,
      receptor,
      importeNeto,
      importeIva,
      total
    );

    if (arcaResult.success && arcaResult.cae) {
      await supabase
        .from('facturas')
        .update({
          cae: arcaResult.cae,
          cae_vencimiento: arcaResult.caeVencimiento,
          estado: 'emitida',
          arca_response: arcaResult,
        })
        .eq('id', factura.id);

      // Update envio if applicable
      if (envio_id) {
        await supabase
          .from('envios')
          .update({
            factura_cae: arcaResult.cae,
            factura_numero: `${String(puntoVenta).padStart(4, '0')}-${String(numeroComprobante).padStart(8, '0')}`,
            factura_tipo: tipo_comprobante,
            factura_fecha: new Date().toISOString(),
            requiere_factura: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', envio_id);
      }

      // Update liquidacion if applicable
      if (liquidacion_seller_id) {
        await supabase
          .from('liquidaciones_seller')
          .update({
            factura_id: factura.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', liquidacion_seller_id);
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
    } else {
      await supabase
        .from('facturas')
        .update({
          estado: 'rechazada',
          error_mensaje: arcaResult.error,
          arca_response: arcaResult,
        })
        .eq('id', factura.id);

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
    console.error('Error in arca-factura:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

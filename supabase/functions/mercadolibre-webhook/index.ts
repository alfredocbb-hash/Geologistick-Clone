import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ML_API_BASE = 'https://api.mercadolibre.com';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Read raw body for signature verification (must read once)
    const rawBody = await req.text();

    // Optional HMAC signature verification (ML "x-signature" header: "ts=...,v1=...")
    // When ML_WEBHOOK_SECRET is configured in edge function secrets, reject unsigned/invalid requests.
    // When not configured, fall back to ML API callback validation (every accepted notification triggers
    // a server-side fetch to ML using the seller's OAuth token before any DB write).
    const webhookSecret = Deno.env.get('ML_WEBHOOK_SECRET');
    if (webhookSecret) {
      const signature = req.headers.get('x-signature') || '';
      const requestId = req.headers.get('x-request-id') || '';
      const parts = Object.fromEntries(
        signature.split(',').map(p => {
          const [k, ...v] = p.trim().split('=');
          return [k, v.join('=')];
        })
      );
      const ts = parts['ts'];
      const v1 = parts['v1'];
      if (!ts || !v1) {
        console.warn('[ML Webhook] Missing x-signature header');
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Reject if timestamp is older than 5 minutes (replay protection)
      if (Math.abs(Date.now() - Number(ts)) > 5 * 60 * 1000) {
        console.warn('[ML Webhook] Stale signature timestamp');
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const manifest = `id:${requestId};ts:${ts};`;
      const keyData = new TextEncoder().encode(webhookSecret);
      const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const sigBytes = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(manifest));
      const expected = Array.from(new Uint8Array(sigBytes))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      if (expected !== v1) {
        console.warn('[ML Webhook] Invalid signature');
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const body = JSON.parse(rawBody);
    console.log('[ML Webhook] Received:', JSON.stringify(body));

    const { topic, resource, user_id } = body;

    // Only process shipment notifications
    if (topic !== 'shipments') {
      console.log('[ML Webhook] Ignoring topic:', topic);
      return new Response(
        JSON.stringify({ message: 'Topic ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract shipment ID from resource path: /shipments/40070866801
    const shipmentId = resource?.replace('/shipments/', '');
    if (!shipmentId) {
      console.error('[ML Webhook] Invalid resource:', resource);
      return new Response(
        JSON.stringify({ error: 'Invalid resource' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find seller by ML user_id
    const { data: seller, error: sellerError } = await supabase
      .from('ecommerce_sellers')
      .select('*')
      .eq('store_id', String(user_id))
      .eq('plataforma', 'mercadolibre')
      .eq('activo', true)
      .single();

    if (sellerError || !seller) {
      console.error('[ML Webhook] Seller not found for user_id:', user_id);
      return new Response(
        JSON.stringify({ error: 'Seller not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Refresh token if needed
    const accessToken = await getValidAccessToken(supabase, seller);
    if (!accessToken) {
      console.error('[ML Webhook] Could not get valid access token');
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get shipment details from ML API
    const shipmentResponse = await fetch(`${ML_API_BASE}/shipments/${shipmentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!shipmentResponse.ok) {
      const errorText = await shipmentResponse.text();
      console.error('[ML Webhook] Failed to fetch shipment:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch shipment details' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const shipment = await shipmentResponse.json();
    console.log('[ML Webhook] Shipment data:', JSON.stringify({
      id: shipment.id,
      status: shipment.status,
      substatus: shipment.substatus,
      logistic_type: shipment.logistic_type,
    }));

    // Only process self_service (Flex) shipments
    if (shipment.logistic_type !== 'self_service') {
      console.log('[ML Webhook] Ignoring non-Flex shipment:', shipment.logistic_type);
      return new Response(
        JSON.stringify({ message: 'Non-Flex shipment ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only create envio when ready_to_ship
    if (shipment.status === 'ready_to_ship') {
      // Check if we already have this shipment
      const { data: existingEnvio } = await supabase
        .from('envios')
        .select('id')
        .eq('ml_shipment_id', shipment.id)
        .maybeSingle();

      if (existingEnvio) {
        console.log('[ML Webhook] Shipment already exists:', existingEnvio.id);
        return new Response(
          JSON.stringify({ message: 'Shipment already exists', envio_id: existingEnvio.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get order details for items and buyer info
      const orderId = shipment.order_id;
      let orderData = null;
      if (orderId) {
        const orderResponse = await fetch(`${ML_API_BASE}/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (orderResponse.ok) {
          orderData = await orderResponse.json();
        }
      }

      // Extract receiver info
      const receiver = shipment.receiver_address || {};
      const receiverName = receiver.receiver_name || orderData?.buyer?.first_name || 'Destinatario';
      const receiverPhone = receiver.receiver_phone || orderData?.buyer?.phone?.number || '';

      // Build address
      const address = [
        receiver.street_name,
        receiver.street_number,
        receiver.comment,
      ].filter(Boolean).join(' ');

      const city = receiver.city?.name || '';
      const state = receiver.state?.name || '';
      const zipCode = receiver.zip_code || '';

      // Use ML shipment ID as tracking number (native ML tracking)
      const trackingNumber = `ML-${shipment.id}`;

      // Calculate fecha_entrega_estimada based on Argentina time
      const nowArg = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const horaArg = nowArg.getUTCHours();
      const fechaArgStr = nowArg.toISOString().substring(0, 10);
      let fechaEntregaEstimada: string;
      if (horaArg >= 12) {
        const tomorrow = new Date(nowArg);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        fechaEntregaEstimada = tomorrow.toISOString().substring(0, 10);
      } else {
        fechaEntregaEstimada = fechaArgStr;
      }

      // Create ecommerce_order first
      const { data: order, error: orderError } = await supabase
        .from('ecommerce_orders')
        .insert({
          seller_id: seller.id,
          tenant_id: seller.tenant_id,
          external_order_id: String(shipment.id),
          external_order_number: String(orderId || shipment.id),
          plataforma: 'mercadolibre',
          ml_shipment_id: shipment.id,
          ml_tracking_number: `ML-${shipment.id}`,
          ml_shipping_status: 'ready_to_ship',
          buyer_name: receiverName,
          buyer_phone: receiverPhone,
          buyer_email: orderData?.buyer?.email || null,
          shipping_address: address,
          shipping_city: city,
          shipping_province: state,
          shipping_postal_code: zipCode,
          shipping_lat: receiver.latitude || null,
          shipping_lng: receiver.longitude || null,
          items: orderData?.order_items || [],
          total: shipment.shipping_cost?.receiver || 0,
          shipping_cost: shipment.lead_time?.cost || shipment.shipping_option?.cost || shipment.cost || 0,
          order_status: 'paid',
          fulfillment_status: 'pending',
          fecha_entrega_estimada: fechaEntregaEstimada,
        })
        .select()
        .single();

      if (orderError) {
        console.error('[ML Webhook] Error creating order:', orderError);
        return new Response(
          JSON.stringify({ error: 'Failed to create order' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract time_frame for delivery schedule
      const timeFrame = shipment.lead_time?.estimated_delivery_time?.time_frame;
      let horarioPreferido = 'cualquier_hora';
      let horarioEntregaDesde: string | null = null;
      let horarioEntregaHasta: string | null = null;
      if (timeFrame?.from != null && timeFrame?.to != null) {
        const fromH = Math.floor(timeFrame.from);
        const fromM = Math.round((timeFrame.from - fromH) * 60);
        const toH = Math.floor(timeFrame.to);
        const toM = Math.round((timeFrame.to - toH) * 60);
        horarioEntregaDesde = `${String(fromH).padStart(2, '0')}:${String(fromM).padStart(2, '0')}`;
        horarioEntregaHasta = `${String(toH).padStart(2, '0')}:${String(toM).padStart(2, '0')}`;

        if (timeFrame.to <= 13) horarioPreferido = 'manana';
        else if (timeFrame.from >= 17) horarioPreferido = 'noche';
        else if (timeFrame.from >= 12) horarioPreferido = 'tarde';
      }

      // Create envio
      const { data: envio, error: envioError } = await supabase
        .from('envios')
        .insert({
          tenant_id: seller.tenant_id,
          tracking_number: trackingNumber,
          ml_shipment_id: shipment.id,
          ml_order_id: orderId || null,
          ml_sync_status: 'synced',
          precio_flete_ml: shipment.lead_time?.cost || shipment.shipping_option?.cost || shipment.cost || 0,
          ml_last_sync_at: new Date().toISOString(),
          estado: 'pendiente',
          nombre_destinatario: receiverName,
          direccion_entrega: address,
          ciudad_entrega: city,
          provincia: state,
          cp_entrega: zipCode,
          destinatario_lat: receiver.latitude || null,
          destinatario_lng: receiver.longitude || null,
          whatsapp_destinatario: receiverPhone,
          precio_total: 0,
          precio_tarifa_vigente: 0,
          tipo_servicio: 'express',
          tipo_servicio_detalle: 'ML Flex',
          sucursal_origen_id: seller.sucursal_pickup_id || null,
          created_by: seller.user_id || null,
          notas: `MercadoLibre Flex - Order #${orderId || shipment.id}`,
          nombre_remitente: seller.nombre,
          remitente_id: seller.cliente_id || null,
          horario_preferido_entrega: horarioPreferido,
          horario_entrega_desde: horarioEntregaDesde,
          horario_entrega_hasta: horarioEntregaHasta,
        })
        .select()
        .single();

      if (envioError) {
        console.error('[ML Webhook] Error creating envio:', envioError);
        return new Response(
          JSON.stringify({ error: 'Failed to create shipment' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Link order to envio
      await supabase
        .from('ecommerce_orders')
        .update({ envio_id: envio.id })
        .eq('id', order.id);

      console.log('[ML Webhook] Created envio:', envio.id, 'tracking:', trackingNumber);

      // Calculate price: from seller's tarifa_id OR by zone matching
      let precioCalculado = 0;
      
      if (seller.tarifa_id) {
        // Direct tarifa assigned to seller
        const { data: tarifa } = await supabase
          .from('tarifas')
          .select('precio_base')
          .eq('id', seller.tarifa_id)
          .single();
        if (tarifa?.precio_base) {
          precioCalculado = tarifa.precio_base;
        }
      }
      
      // Fallback: search by zone if no tarifa_id or tarifa has no price
      if (precioCalculado === 0 && city) {
        const { data: zonaTarifas } = await supabase
          .from('tarifas')
          .select('precio_base, zona_destino')
          .eq('tenant_id', seller.tenant_id)
          .eq('tipo_tarifa', 'zona')
          .eq('activa', true);
        
        if (zonaTarifas && zonaTarifas.length > 0) {
          const cityNorm = city.toLowerCase().trim();
          // First try exact match, then substring
          for (const t of zonaTarifas) {
            if (!t.zona_destino) continue;
            const destinos = t.zona_destino.split(',').map((d: string) => d.toLowerCase().trim());
            if (destinos.includes(cityNorm)) {
              precioCalculado = t.precio_base || 0;
              break;
            }
          }
          // Substring fallback
          if (precioCalculado === 0) {
            for (const t of zonaTarifas) {
              if (!t.zona_destino) continue;
              const destinos = t.zona_destino.split(',').map((d: string) => d.toLowerCase().trim());
              if (destinos.some((d: string) => d.includes(cityNorm) || cityNorm.includes(d))) {
                precioCalculado = t.precio_base || 0;
                break;
              }
            }
          }
          if (precioCalculado > 0) {
            console.log('[ML Webhook] Price from zone match:', precioCalculado, 'for city:', city);
          }
        }
      }

      // Update envio with calculated price
      if (precioCalculado > 0) {
        await supabase
          .from('envios')
          .update({ precio_total: precioCalculado, precio_tarifa_vigente: precioCalculado })
          .eq('id', envio.id);
      }

      // Register charge in seller's cuenta corriente if enabled
      if (precioCalculado > 0 && seller.tiene_cuenta_corriente) {
        const saldoAnterior = seller.saldo_cuenta_corriente || 0;
        const saldoNuevo = saldoAnterior + precioCalculado;

        const { error: cargoError } = await supabase
          .from('seller_cuenta_corriente')
          .insert({
            seller_id: seller.id,
            tipo: 'cargo',
            monto: precioCalculado,
            saldo_anterior: saldoAnterior,
            saldo_nuevo: saldoNuevo,
            descripcion: `Envío ML Flex - ${trackingNumber}`,
            envio_id: envio.id,
          });

        if (cargoError) {
          console.error('[ML Webhook] Error creating cargo:', cargoError);
        } else {
          await supabase
            .from('ecommerce_sellers')
            .update({ 
              saldo_cuenta_corriente: saldoNuevo,
              updated_at: new Date().toISOString(),
            })
            .eq('id', seller.id);

          console.log('[ML Webhook] Registered cargo:', precioCalculado, 'new balance:', saldoNuevo);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          envio_id: envio.id, 
          tracking: trackingNumber,
          ml_shipment_id: shipment.id,
          precio: precioCalculado,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For other statuses, update envio estado based on ml_status_mapping
    const { data: existingEnvio } = await supabase
      .from('envios')
      .select('id, estado')
      .eq('ml_shipment_id', shipment.id)
      .maybeSingle();

    if (existingEnvio) {
      // 1. Look up mapping: ML status+substatus -> internal estado
      let mappingQuery = supabase
        .from('ml_status_mapping')
        .select('estado_interno, descripcion')
        .eq('ml_status', shipment.status);

      if (shipment.substatus) {
        mappingQuery = mappingQuery.eq('ml_substatus', shipment.substatus);
      } else {
        mappingQuery = mappingQuery.is('ml_substatus', null);
      }

      let { data: mapping } = await mappingQuery.maybeSingle();

      // Fallback: if no mapping with substatus, try without substatus
      if (!mapping && shipment.substatus) {
        const { data: fallbackMapping } = await supabase
          .from('ml_status_mapping')
          .select('estado_interno, descripcion')
          .eq('ml_status', shipment.status)
          .is('ml_substatus', null)
          .maybeSingle();
        mapping = fallbackMapping;
      }

      const now = new Date().toISOString();

      // 2. Update estado if mapping found and different from current
      if (mapping && mapping.estado_interno !== existingEnvio.estado) {
        console.log('[ML Webhook] Updating envio', existingEnvio.id, 'from', existingEnvio.estado, 'to', mapping.estado_interno);

        await supabase.from('envios').update({
          estado: mapping.estado_interno,
          estado_ml: mapping.estado_interno,
          ml_substatus_actual: shipment.substatus ?? null,
          ml_sync_status: 'synced',
          ml_last_sync_at: now,
        }).eq('id', existingEnvio.id);

        // 3. Register in history
        await supabase.from('envio_historial').insert({
          envio_id: existingEnvio.id,
          estado_anterior: existingEnvio.estado,
          estado_nuevo: mapping.estado_interno,
          notas: 'Actualizado automaticamente via webhook MercadoLibre: ' + mapping.descripcion + (shipment.substatus ? ' [' + shipment.substatus + ']' : ''),
          ubicacion: 'ML Webhook',
        });

        // 4. Update ecommerce_orders
        await supabase.from('ecommerce_orders')
          .update({
            ml_shipping_status: shipment.status,
            fulfillment_status: mapping.estado_interno === 'entregado' ? 'fulfilled' : 'pending',
          })
          .eq('ml_shipment_id', shipment.id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            envio_id: existingEnvio.id,
            estado_anterior: existingEnvio.estado,
            estado_nuevo: mapping.estado_interno,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // No mapping or same status, just update sync timestamp + substatus
        await supabase.from('envios').update({
          estado_ml: mapping?.estado_interno || shipment.status,
          ml_substatus_actual: shipment.substatus ?? null,
          ml_sync_status: 'synced',
          ml_last_sync_at: now,
        }).eq('id', existingEnvio.id);
      }
    }

    return new Response(
      JSON.stringify({ message: 'Webhook processed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ML Webhook] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper to get valid access token, refreshing if needed
async function getValidAccessToken(supabase: any, seller: any): Promise<string | null> {
  const now = new Date();
  const expiresAt = seller.token_expires_at ? new Date(seller.token_expires_at) : null;

  // Check if token is expired or about to expire (5 min buffer)
  if (expiresAt && expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return seller.access_token;
  }

  console.log('[ML Webhook] Token expired, refreshing...');

  // Get ML credentials using key-value schema
  const { data: credentials, error: credError } = await supabase
    .from('system_integrations')
    .select('config_key, config_value')
    .eq('tenant_id', seller.tenant_id)
    .eq('integration_type', 'mercadolibre')
    .in('config_key', ['client_id', 'client_secret']);

  if (credError || !credentials || credentials.length === 0) {
    console.error('[ML Webhook] No integration config found');
    return null;
  }

  const config: Record<string, string> = {};
  for (const row of credentials) {
    config[row.config_key] = row.config_value;
  }

  if (!config.client_id || !config.client_secret) {
    console.error('[ML Webhook] Missing client_id or client_secret');
    return null;
  }

  // Refresh token
  const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.client_id,
      client_secret: config.client_secret,
      refresh_token: seller.refresh_token,
    }),
  });

  if (!tokenResponse.ok) {
    console.error('[ML Webhook] Token refresh failed');
    return null;
  }

  const tokenData = await tokenResponse.json();

  // Update seller with new tokens
  const newExpiresAt = new Date();
  newExpiresAt.setSeconds(newExpiresAt.getSeconds() + tokenData.expires_in);

  await supabase
    .from('ecommerce_sellers')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', seller.id);

  return tokenData.access_token;
}

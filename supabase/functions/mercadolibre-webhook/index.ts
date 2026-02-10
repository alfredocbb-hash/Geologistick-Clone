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

    const body = await req.json();
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

      // Generate tracking number
      const trackingPrefix = seller.tenant_id?.substring(0, 3).toUpperCase() || 'ML';
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      const trackingNumber = `${trackingPrefix}-ENV-${date}-${random}`;

      // Create ecommerce_order first
      const { data: order, error: orderError } = await supabase
        .from('ecommerce_orders')
        .insert({
          seller_id: seller.id,
          tenant_id: seller.tenant_id,
          external_order_id: String(shipment.id),
          external_order_number: String(orderId || shipment.id),
          plataforma: 'mercadolibre',
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
          order_status: 'paid',
          fulfillment_status: 'pending',
          raw_data: shipment,
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

      // Create envio
      const { data: envio, error: envioError } = await supabase
        .from('envios')
        .insert({
          tenant_id: seller.tenant_id,
          tracking_number: trackingNumber,
          ml_shipment_id: shipment.id,
          ml_order_id: orderId || null,
          ml_sync_status: 'synced',
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
          precio_total: 0, // Will be calculated based on tarifa
          tipo_servicio: 'express',
          tipo_servicio_detalle: 'ML Flex',
          sucursal_origen_id: seller.sucursal_pickup_id || null,
          created_by: seller.user_id || null,
          notas: `MercadoLibre Flex - Order #${orderId || shipment.id}`,
          nombre_remitente: seller.nombre,
          remitente_id: seller.cliente_id || null,
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

      // Register charge in seller's cuenta corriente if enabled
      let precioCalculado = 0;
      if (seller.tiene_cuenta_corriente && seller.tarifa_id) {
        // Get tarifa to calculate price
        const { data: tarifa } = await supabase
          .from('tarifas')
          .select('precio_base')
          .eq('id', seller.tarifa_id)
          .single();

        if (tarifa?.precio_base) {
          precioCalculado = tarifa.precio_base;
          const saldoAnterior = seller.saldo_cuenta_corriente || 0;
          const saldoNuevo = saldoAnterior + precioCalculado;

          // Insert cargo in seller_cuenta_corriente
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
            // Update seller balance
            await supabase
              .from('ecommerce_sellers')
              .update({ 
                saldo_cuenta_corriente: saldoNuevo,
                updated_at: new Date().toISOString(),
              })
              .eq('id', seller.id);

            // Update envio with calculated price
            await supabase
              .from('envios')
              .update({ precio_total: precioCalculado })
              .eq('id', envio.id);

            console.log('[ML Webhook] Registered cargo:', precioCalculado, 'new balance:', saldoNuevo);
          }
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

    // For other statuses, just update sync timestamp if envio exists
    const { data: existingEnvio } = await supabase
      .from('envios')
      .select('id')
      .eq('ml_shipment_id', shipment.id)
      .maybeSingle();

    if (existingEnvio) {
      await supabase
        .from('envios')
        .update({
          ml_sync_status: 'synced',
          ml_last_sync_at: new Date().toISOString(),
        })
        .eq('id', existingEnvio.id);
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

  // Get ML credentials
  const { data: integration } = await supabase
    .from('system_integrations')
    .select('config')
    .eq('tenant_id', seller.tenant_id)
    .eq('integration_type', 'mercado_libre')
    .eq('is_active', true)
    .single();

  if (!integration?.config) {
    console.error('[ML Webhook] No integration config found');
    return null;
  }

  const config = integration.config as Record<string, string>;

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

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

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;

    // Get seller_id from body
    const body = await req.json();
    const { seller_id } = body;

    if (!seller_id) {
      return new Response(
        JSON.stringify({ error: 'seller_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[ML Sync] Starting sync for seller:', seller_id);

    // Get seller data
    const { data: seller, error: sellerError } = await supabase
      .from('ecommerce_sellers')
      .select('*')
      .eq('id', seller_id)
      .eq('plataforma', 'mercadolibre')
      .single();

    if (sellerError || !seller) {
      console.error('[ML Sync] Seller not found:', sellerError);
      return new Response(
        JSON.stringify({ error: 'Seller not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user belongs to the same tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', userId)
      .single();

    if (!profile || profile.tenant_id !== seller.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get valid access token (refresh if needed)
    const accessToken = await getValidAccessToken(supabase, seller);
    if (!accessToken) {
      console.error('[ML Sync] Could not get valid access token');
      return new Response(
        JSON.stringify({ error: 'Authentication failed. Please reconnect the store.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Search for ready_to_ship Flex shipments
    const searchUrl = `${ML_API_BASE}/users/${seller.store_id}/shipping_labels/shipments/search?status=ready_to_ship&shipping_mode=self_service&limit=50`;
    console.log('[ML Sync] Fetching shipments from:', searchUrl);

    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('[ML Sync] Failed to search shipments:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch shipments from MercadoLibre' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchData = await searchResponse.json();
    const shipmentIds = searchData.results || [];
    console.log('[ML Sync] Found', shipmentIds.length, 'shipments');

    let created = 0;
    let existing = 0;
    let errors = 0;

    // Process each shipment
    for (const shipmentId of shipmentIds) {
      try {
        // Check if already exists
        const { data: existingEnvio } = await supabase
          .from('envios')
          .select('id')
          .eq('ml_shipment_id', shipmentId)
          .maybeSingle();

        if (existingEnvio) {
          console.log('[ML Sync] Shipment already exists:', shipmentId);
          existing++;
          continue;
        }

        // Get shipment details
        const shipmentResponse = await fetch(`${ML_API_BASE}/shipments/${shipmentId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!shipmentResponse.ok) {
          console.error('[ML Sync] Failed to get shipment details:', shipmentId);
          errors++;
          continue;
        }

        const shipment = await shipmentResponse.json();

        // Only process self_service (Flex)
        if (shipment.logistic_type !== 'self_service') {
          console.log('[ML Sync] Skipping non-Flex shipment:', shipmentId);
          continue;
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
          console.error('[ML Sync] Error creating order:', orderError);
          errors++;
          continue;
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
            precio_total: 0,
            tipo_servicio: 'express',
            tipo_servicio_detalle: 'ML Flex',
            sucursal_origen_id: seller.sucursal_pickup_id || null,
            created_by: userId,
            notas: `MercadoLibre Flex - Order #${orderId || shipment.id}`,
          })
          .select()
          .single();

        if (envioError) {
          console.error('[ML Sync] Error creating envio:', envioError);
          errors++;
          continue;
        }

        // Link order to envio
        await supabase
          .from('ecommerce_orders')
          .update({ envio_id: envio.id })
          .eq('id', order.id);

        console.log('[ML Sync] Created envio:', envio.id, 'tracking:', trackingNumber);

        // Register charge in seller's cuenta corriente if enabled
        let precioCalculado = 0;
        if (seller.tiene_cuenta_corriente && seller.tarifa_id) {
          const { data: tarifa } = await supabase
            .from('tarifas')
            .select('precio_base')
            .eq('id', seller.tarifa_id)
            .single();

          if (tarifa?.precio_base) {
            precioCalculado = tarifa.precio_base;
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

            if (!cargoError) {
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

              console.log('[ML Sync] Registered cargo:', precioCalculado);
              
              // Update local seller balance for next iteration
              seller.saldo_cuenta_corriente = saldoNuevo;
            }
          }
        }

        created++;
      } catch (err) {
        console.error('[ML Sync] Error processing shipment:', shipmentId, err);
        errors++;
      }
    }

    // Update seller's ultimo_sync
    await supabase
      .from('ecommerce_sellers')
      .update({ ultimo_sync: new Date().toISOString() })
      .eq('id', seller.id);

    console.log('[ML Sync] Completed. Created:', created, 'Existing:', existing, 'Errors:', errors);

    return new Response(
      JSON.stringify({ 
        success: true, 
        created, 
        existing, 
        errors,
        total: shipmentIds.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ML Sync] Error:', error);
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

  // Check if token is valid (5 min buffer)
  if (expiresAt && expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return seller.access_token;
  }

  console.log('[ML Sync] Token expired, refreshing...');

  // Get ML credentials
  const { data: integration } = await supabase
    .from('system_integrations')
    .select('config')
    .eq('tenant_id', seller.tenant_id)
    .eq('integration_type', 'mercadolibre')
    .eq('is_active', true)
    .single();

  if (!integration?.config) {
    console.error('[ML Sync] No integration config found');
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
    console.error('[ML Sync] Token refresh failed');
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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ML_API_BASE = 'https://api.mercadolibre.com';

// Priority map: higher = more advanced state. Never downgrade.
const ESTADO_PRIORITY: Record<string, number> = {
  pendiente: 0,
  recogido: 1,
  en_sucursal: 2,
  en_bodega: 2,
  en_transito: 3,
  en_reparto: 4,
  primera_visita: 5,
  ausente: 5,
  incidencia: 5,
  entregado: 10,
  no_entregado: 10,
  devuelto: 10,
  cancelado: 10,
};

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

    // Search for orders with date filter to avoid importing old history
    const statuses = ['ready_to_ship', 'shipped', 'delivered', 'not_delivered'];
    console.log('[ML Sync] Fetching orders for statuses:', statuses.join(', '));

    // Active statuses: last 7 days; resolved statuses: last 3 days
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const allOrders: any[] = [];
    const seenIds = new Set();
    const PAGE_LIMIT = 50;
    const MAX_OFFSET = 450;

    for (const status of statuses) {
      const dateFrom = (status === 'delivered' || status === 'not_delivered') ? threeDaysAgo : sevenDaysAgo;
      let offset = 0;
      while (offset <= MAX_OFFSET) {
        const url = `${ML_API_BASE}/orders/search?seller=${seller.store_id}&shipping.status=${status}&sort=date_desc&limit=${PAGE_LIMIT}&offset=${offset}&order.date_created.from=${dateFrom}`;
        console.log(`[ML Sync] Fetching status=${status} offset=${offset}`);
        
        const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!response.ok) {
          console.error('[ML Sync] Failed to search orders for status', status, 'offset', offset, ':', response.status);
          break;
        }
        
        const data = await response.json();
        const results = data.results || [];
        
        for (const order of results) {
          if (!seenIds.has(order.id)) {
            seenIds.add(order.id);
            allOrders.push(order);
          }
        }
        
        console.log(`[ML Sync] Got ${results.length} results for status=${status} offset=${offset}`);
        if (results.length < PAGE_LIMIT) break;
        offset += PAGE_LIMIT;
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const orders = allOrders;
    console.log('[ML Sync] Found', orders.length, 'orders (deduplicated, paginated)');

    // BATCH: Collect all shipment IDs and lookup existing ones in a single query
    const allShipmentIds = orders
      .map(o => o.shipping?.id)
      .filter((id): id is number => !!id);

    const existingEnviosMap = new Map<number, string>();
    if (allShipmentIds.length > 0) {
      // Query in chunks of 100 to avoid URL length limits
      for (let i = 0; i < allShipmentIds.length; i += 100) {
        const chunk = allShipmentIds.slice(i, i + 100);
        const { data: existingEnvios } = await supabase
          .from('envios')
          .select('id, ml_shipment_id')
          .in('ml_shipment_id', chunk);
        
        if (existingEnvios) {
          for (const e of existingEnvios) {
            if (e.ml_shipment_id) existingEnviosMap.set(e.ml_shipment_id, e.id);
          }
        }
      }
    }
    console.log('[ML Sync] Batch lookup found', existingEnviosMap.size, 'existing shipments');

    let created = 0;
    let existing = 0;
    let errors = 0;

    // Process each order
    for (const orderItem of orders) {
      try {
        const orderId = orderItem.id;
        const shipmentId = orderItem.shipping?.id;

        if (!shipmentId) {
          console.log('[ML Sync] Order without shipment:', orderId);
          continue;
        }

        // Check if already exists using batch map
        const existingEnvioId = existingEnviosMap.get(shipmentId);

        if (existingEnvioId) {
          // ALWAYS fetch real shipment status from ML API for existing envíos
          let realStatus = orderItem.shipping?.status || 'ready_to_ship';
          let realSubstatus = orderItem.shipping?.substatus || null;

          try {
            const shipResp = await fetch(`${ML_API_BASE}/shipments/${shipmentId}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (shipResp.ok) {
              const shipData = await shipResp.json();
              realStatus = shipData.status || realStatus;
              realSubstatus = shipData.substatus || null;
              console.log('[ML Sync] Real shipment', shipmentId, ':', realStatus, realSubstatus);
            } else {
              console.error('[ML Sync] Failed to fetch shipment', shipmentId, ':', shipResp.status);
            }
            // Rate limiting: 150ms between shipment API calls
            await new Promise(resolve => setTimeout(resolve, 150));
          } catch (e) {
            console.error('[ML Sync] Error fetching real status:', shipmentId, e);
          }

          // Buscar mapping con status/substatus REALES de ML
          let mappingQuery = supabase.from('ml_status_mapping')
            .select('estado_interno, descripcion')
            .eq('ml_status', realStatus);

          if (realSubstatus) {
            mappingQuery = mappingQuery.eq('ml_substatus', realSubstatus);
          } else {
            mappingQuery = mappingQuery.is('ml_substatus', null);
          }

          let { data: mapping } = await mappingQuery.maybeSingle();

          // Fallback: buscar sin substatus
          if (!mapping && realSubstatus) {
            const { data: fb } = await supabase.from('ml_status_mapping')
              .select('estado_interno, descripcion')
              .eq('ml_status', realStatus)
              .is('ml_substatus', null)
              .maybeSingle();
            mapping = fb;
          }

          const newEnvioEstado = mapping?.estado_interno || 'pendiente';

          // Obtener estado actual para comparar
          const { data: envioActual } = await supabase.from('envios')
            .select('estado, estado_ml').eq('id', existingEnvioId).single();

          const currentEstado = envioActual?.estado || 'pendiente';

          // DUAL STATUS: Only update estado_ml, never touch estado directly
          await supabase.from('envios').update({
            estado_ml: newEnvioEstado,
            ml_sync_status: 'synced',
            ml_last_sync_at: new Date().toISOString(),
          }).eq('id', existingEnvioId);

          if (envioActual && envioActual.estado_ml !== newEnvioEstado) {
            console.log('[ML Sync] estado_ml updated:', existingEnvioId, envioActual.estado_ml, '->', newEnvioEstado, '(estado interno:', currentEstado, ')');
          }

          // Actualizar ecommerce_order con status REAL de ML
          await supabase.from('ecommerce_orders').update({
            ml_shipping_status: realStatus,
            fulfillment_status: newEnvioEstado === 'entregado' ? 'fulfilled' : 'pending',
            updated_at: new Date().toISOString(),
          }).eq('ml_shipment_id', shipmentId);

          existing++;
          continue;
        }

        // Get full shipment details
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
          console.log('[ML Sync] Skipping non-Flex shipment:', shipmentId, 'type:', shipment.logistic_type);
          continue;
        }

        // Filter by today's delivery date (Argentina timezone UTC-3)
        const estimatedDelivery = shipment.shipping_option?.estimated_delivery_time?.date;
        if (estimatedDelivery) {
          // Extract date part (YYYY-MM-DD) from the estimated delivery
          const deliveryDate = estimatedDelivery.substring(0, 10);
          // Get today's date in Argentina timezone (UTC-3)
          const nowArg = new Date(Date.now() - 3 * 60 * 60 * 1000);
          const todayArg = nowArg.toISOString().substring(0, 10);
          
          if (deliveryDate !== todayArg) {
            console.log('[ML Sync] Skipping shipment with delivery date', deliveryDate, '(today:', todayArg, ') shipment:', shipmentId);
            continue;
          }
        } else {
          console.log('[ML Sync] Skipping shipment without estimated delivery date:', shipmentId);
          continue;
        }

        // Map ML shipping status to internal statuses
        const mlShippingStatus = orderItem.shipping?.status || 'ready_to_ship';
        const fulfillmentStatus = mlShippingStatus === 'shipped' ? 'shipped' : 'pending';
        const envioEstado = mlShippingStatus === 'shipped' ? 'en_transito' : 'pendiente';

        // Calculate total from order items
        const orderTotal = (orderItem.order_items || []).reduce(
          (sum: number, item: any) => sum + (item.unit_price || 0) * (item.quantity || 1), 0
        );

        // Extract ML shipping cost - priority: lead_time.cost (documented), then fallbacks
        const mlShippingCost = shipment.lead_time?.cost 
          || shipment.shipping_option?.cost 
          || shipment.cost 
          || 0;
        console.log('[ML Sync] ML shipping cost:', mlShippingCost, 'lead_time:', JSON.stringify(shipment.lead_time));

        // Use orderItem data which already has buyer info
        const orderData = orderItem;

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
        const nowArgSync = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const horaArgSync = nowArgSync.getUTCHours();
        const fechaArgSyncStr = nowArgSync.toISOString().substring(0, 10);
        let fechaEntregaEstimada: string;
        if (horaArgSync >= 12) {
          const tomorrow = new Date(nowArgSync);
          tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
          fechaEntregaEstimada = tomorrow.toISOString().substring(0, 10);
        } else {
          fechaEntregaEstimada = fechaArgSyncStr;
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
            total: orderTotal,
            shipping_cost: mlShippingCost,
            order_status: 'paid',
            fulfillment_status: fulfillmentStatus,
            ml_shipping_status: mlShippingStatus,
            raw_data: shipment,
            fecha_entrega_estimada: fechaEntregaEstimada,
          })
          .select()
          .single();

        if (orderError) {
          console.error('[ML Sync] Error creating order:', orderError);
          errors++;
          continue;
        }

        // Create envio with ML shipping cost and zone-based pricing
        let precioCalculadoSync = 0;
        let tarifaIdSync: string | null = null;
        let tarifaMetodoSync: string | null = null;

        // Try zone-based pricing using city
        if (city) {
          const { data: zoneTarifas } = await supabase
            .from('tarifas')
            .select('id, precio_base, zona_destino')
            .eq('tenant_id', seller.tenant_id)
            .eq('tipo_tarifa', 'zona')
            .eq('activa', true);

          if (zoneTarifas && zoneTarifas.length > 0) {
            const normalize = (str: string) => str.toLowerCase().trim()
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const ciudadNorm = normalize(city);

            for (const tarifa of zoneTarifas) {
              if (!tarifa.zona_destino) continue;
              const zonas = tarifa.zona_destino.split(',').map((z: string) => normalize(z));
              for (const zona of zonas) {
                if (zona === ciudadNorm || ciudadNorm.includes(zona) || zona.includes(ciudadNorm)) {
                  precioCalculadoSync = tarifa.precio_base || 0;
                  tarifaIdSync = tarifa.id;
                  tarifaMetodoSync = 'zona';
                  console.log('[ML Sync] Zone match:', tarifa.zona_destino, '-> precio:', precioCalculadoSync);
                  break;
                }
              }
              if (precioCalculadoSync > 0) break;
            }

            // Fallback: use the broadest zone as catch-all
            if (precioCalculadoSync === 0) {
              const fallback = zoneTarifas
                .filter(t => t.zona_destino && t.zona_destino.split(',').length > 3)
                .sort((a, b) => (b.zona_destino?.split(',').length || 0) - (a.zona_destino?.split(',').length || 0))[0];
              if (fallback) {
                precioCalculadoSync = fallback.precio_base || 0;
                tarifaIdSync = fallback.id;
                tarifaMetodoSync = 'zona_fallback';
                console.log('[ML Sync] Zone fallback applied for city:', city, '-> precio:', precioCalculadoSync);
              }
            }
          }
        }

        const { data: envio, error: envioError } = await supabase
          .from('envios')
          .insert({
            tenant_id: seller.tenant_id,
            tracking_number: trackingNumber,
            ml_shipment_id: shipment.id,
            ml_order_id: orderId || null,
            ml_sync_status: 'synced',
            ml_last_sync_at: new Date().toISOString(),
            estado: envioEstado,
            nombre_destinatario: receiverName,
            direccion_entrega: address,
            ciudad_entrega: city,
            provincia: state,
            cp_entrega: zipCode,
            destinatario_lat: receiver.latitude || null,
            destinatario_lng: receiver.longitude || null,
            whatsapp_destinatario: receiverPhone,
            precio_total: precioCalculadoSync,
            tarifa_id: tarifaIdSync,
            tarifa_metodo_aplicado: tarifaMetodoSync,
            precio_flete_ml: mlShippingCost,
            tipo_servicio: 'express',
            tipo_servicio_detalle: 'ML Flex',
            sucursal_origen_id: seller.sucursal_pickup_id || null,
            created_by: userId,
            notas: `MercadoLibre Flex - Order #${orderId || shipment.id}`,
            nombre_remitente: seller.nombre,
            remitente_id: seller.cliente_id || null,
            estado_ml: envioEstado,
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
        // Use zone price if calculated, otherwise fall back to seller tarifa
        let precioFinalSync = precioCalculadoSync;
        if (precioFinalSync === 0 && seller.tiene_cuenta_corriente && seller.tarifa_id) {
          const { data: tarifa } = await supabase
            .from('tarifas')
            .select('precio_base')
            .eq('id', seller.tarifa_id)
            .single();

          if (tarifa?.precio_base) {
            precioFinalSync = tarifa.precio_base;
            // Update envio with seller tarifa price
            await supabase
              .from('envios')
              .update({ precio_total: precioFinalSync, tarifa_id: seller.tarifa_id, tarifa_metodo_aplicado: 'tarifa_seller' })
              .eq('id', envio.id);
          }
        }

        if (precioFinalSync > 0 && seller.tiene_cuenta_corriente) {
            const saldoAnterior = seller.saldo_cuenta_corriente || 0;
            const saldoNuevo = saldoAnterior + precioFinalSync;

            const { error: cargoError } = await supabase
              .from('seller_cuenta_corriente')
              .insert({
                seller_id: seller.id,
                tipo: 'cargo',
                monto: precioFinalSync,
                saldo_anterior: saldoAnterior,
                saldo_nuevo: saldoNuevo,
                descripcion: `Envío ML Flex - ${trackingNumber}`,
                envio_id: envio.id,
              });

            if (!cargoError) {
              await supabase
                .from('ecommerce_sellers')
                .update({ 
                  saldo_cuenta_corriente: saldoNuevo,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', seller.id);

              console.log('[ML Sync] Registered cargo:', precioFinalSync);
              seller.saldo_cuenta_corriente = saldoNuevo;
            }
        }

        created++;
      } catch (err) {
        console.error('[ML Sync] Error processing order:', orderItem?.id, err);
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
        total: orders.length
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
  if (seller.access_token && expiresAt && expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return seller.access_token;
  }

  // If no refresh token, cannot refresh
  if (!seller.refresh_token) {
    console.error('[ML Sync] No refresh token available');
    return null;
  }

  console.log('[ML Sync] Token expired, refreshing...');

  // Get ML credentials using key-value schema (same pattern as mercadolibre-oauth)
  const { data: credentials, error: credError } = await supabase
    .from('system_integrations')
    .select('config_key, config_value')
    .eq('tenant_id', seller.tenant_id)
    .eq('integration_type', 'mercadolibre')
    .in('config_key', ['client_id', 'client_secret']);

  if (credError || !credentials || credentials.length === 0) {
    console.error('[ML Sync] No integration credentials found:', credError);
    return null;
  }

  // Convert key-value rows to object
  const config: Record<string, string> = {};
  for (const row of credentials) {
    config[row.config_key] = row.config_value;
  }

  if (!config.client_id || !config.client_secret) {
    console.error('[ML Sync] Missing client_id or client_secret');
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
    const errorText = await tokenResponse.text();
    console.error('[ML Sync] Token refresh failed:', errorText);
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

  console.log('[ML Sync] Token refreshed successfully');
  return tokenData.access_token;
}

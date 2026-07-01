import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ML_API_BASE = 'https://api.mercadolibre.com';
const TENANT_ID = '94a9ea85-43c5-49ac-9bfa-86843072c2ce';
const DATE_FROM = '2026-02-06T15:01:00.000-00:00'; // 12:01 ARG = 15:01 UTC
const DATE_TO = '2026-02-12T23:59:59.000-00:00';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Recovery] Starting recovery for Beraexpress tenant:', TENANT_ID);

    // 1. Get all active ML sellers for this tenant
    const { data: sellers, error: sellersError } = await supabase
      .from('ecommerce_sellers')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .eq('plataforma', 'mercadolibre')
      .eq('activo', true);

    if (sellersError || !sellers?.length) {
      console.error('[Recovery] No sellers found:', sellersError);
      return new Response(
        JSON.stringify({ error: 'No active ML sellers found', detail: sellersError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Recovery] Found', sellers.length, 'active sellers');

    const results: any[] = [];
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const seller of sellers) {
      console.log(`[Recovery] Processing seller: ${seller.nombre} (${seller.store_id})`);

      // Get valid access token
      const accessToken = await getValidAccessToken(supabase, seller);
      if (!accessToken) {
        console.error(`[Recovery] Could not get token for seller ${seller.nombre}`);
        results.push({ seller: seller.nombre, error: 'token_failed', created: 0, skipped: 0 });
        continue;
      }

      // Fetch delivered orders from ML API with pagination
      const allOrders: any[] = [];
      const seenOrderIds = new Set();
      let offset = 0;
      const PAGE_LIMIT = 50;
      const MAX_PAGES = 10;

      while (offset < PAGE_LIMIT * MAX_PAGES) {
        const url = `${ML_API_BASE}/orders/search?seller=${seller.store_id}&shipping.status=delivered&sort=date_desc&limit=${PAGE_LIMIT}&offset=${offset}&order.date_created.from=${DATE_FROM}`;
        console.log(`[Recovery] Fetching offset=${offset} for ${seller.nombre}`);

        const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!response.ok) {
          console.error(`[Recovery] ML API error for ${seller.nombre}:`, response.status);
          break;
        }

        const data = await response.json();
        const orderResults = data.results || [];

        for (const order of orderResults) {
          // Filter by date range
          const createdDate = new Date(order.date_created);
          if (createdDate < new Date(DATE_FROM) || createdDate > new Date(DATE_TO)) continue;

          if (!seenOrderIds.has(order.id)) {
            seenOrderIds.add(order.id);
            allOrders.push(order);
          }
        }

        console.log(`[Recovery] Got ${orderResults.length} results at offset=${offset}`);
        if (orderResults.length < PAGE_LIMIT) break;
        offset += PAGE_LIMIT;
        await new Promise(r => setTimeout(r, 200));
      }

      console.log(`[Recovery] ${seller.nombre}: ${allOrders.length} delivered orders in range`);

      if (allOrders.length === 0) {
        results.push({ seller: seller.nombre, created: 0, skipped: 0, total_orders: 0 });
        continue;
      }

      // Batch check existing shipments
      const shipmentIds = allOrders.map(o => o.shipping?.id).filter((id): id is number => !!id);
      const existingSet = new Set<number>();

      for (let i = 0; i < shipmentIds.length; i += 100) {
        const chunk = shipmentIds.slice(i, i + 100);
        const { data: existing } = await supabase
          .from('envios')
          .select('ml_shipment_id')
          .in('ml_shipment_id', chunk);
        if (existing) {
          for (const e of existing) {
            if (e.ml_shipment_id) existingSet.add(e.ml_shipment_id);
          }
        }
      }

      // Also check ecommerce_orders to avoid duplicate external_order_id
      const orderExtIds = allOrders.map(o => String(o.shipping?.id || o.id));
      const existingOrderSet = new Set<string>();
      for (let i = 0; i < orderExtIds.length; i += 100) {
        const chunk = orderExtIds.slice(i, i + 100);
        const { data: existingOrders } = await supabase
          .from('ecommerce_orders')
          .select('external_order_id')
          .in('external_order_id', chunk)
          .eq('seller_id', seller.id);
        if (existingOrders) {
          for (const eo of existingOrders) {
            existingOrderSet.add(eo.external_order_id);
          }
        }
      }

      console.log(`[Recovery] ${seller.nombre}: ${existingSet.size} already in envios, ${existingOrderSet.size} already in orders`);

      let sellerCreated = 0;
      let sellerSkipped = 0;
      let sellerErrors = 0;

      // Get current seller balance for cuenta corriente
      const { data: currentSeller } = await supabase
        .from('ecommerce_sellers')
        .select('saldo_cuenta_corriente')
        .eq('id', seller.id)
        .single();
      let runningBalance = currentSeller?.saldo_cuenta_corriente || 0;

      for (const orderItem of allOrders) {
        const shipmentId = orderItem.shipping?.id;
        if (!shipmentId) continue;

        if (existingSet.has(shipmentId)) {
          sellerSkipped++;
          continue;
        }

        try {
          // Get shipment details from ML
          const shipResp = await fetch(`${ML_API_BASE}/shipments/${shipmentId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!shipResp.ok) {
            console.error(`[Recovery] Failed to get shipment ${shipmentId}:`, shipResp.status);
            sellerErrors++;
            continue;
          }
          const shipment = await shipResp.json();
          await new Promise(r => setTimeout(r, 200));

          // Only Flex (self_service)
          if (shipment.logistic_type !== 'self_service') {
            console.log(`[Recovery] Skipping non-Flex: ${shipmentId} (${shipment.logistic_type})`);
            sellerSkipped++;
            continue;
          }

          // Extract data
          const receiver = shipment.receiver_address || {};
          const receiverName = receiver.receiver_name || orderItem?.buyer?.first_name || 'Destinatario';
          const receiverPhone = receiver.receiver_phone || orderItem?.buyer?.phone?.number || '';
          const address = [receiver.street_name, receiver.street_number, receiver.comment].filter(Boolean).join(' ');
          const city = receiver.city?.name || '';
          const state = receiver.state?.name || '';
          const zipCode = receiver.zip_code || '';
          const trackingNumber = `ML-${shipment.id}`;

          const mlShippingCost = shipment.lead_time?.cost || shipment.shipping_option?.cost || shipment.cost || 0;

          // Calculate price using zone-based pricing
          let precioTotal = 0;
          let tarifaId: string | null = null;
          let tarifaMetodo: string | null = null;

          if (city) {
            const { data: zoneTarifas } = await supabase
              .from('tarifas')
              .select('id, precio_base, zona_destino')
              .eq('tenant_id', seller.tenant_id)
              .eq('tipo_tarifa', 'zona')
              .eq('activa', true);

            if (zoneTarifas?.length) {
              const normalize = (str: string) => str.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              const ciudadNorm = normalize(city);

              // Pass 1: exact match (highest priority)
              for (const tarifa of zoneTarifas) {
                if (!tarifa.zona_destino) continue;
                const zonas = tarifa.zona_destino.split(',').map((z: string) => normalize(z.trim()));
                if (zonas.some((z: string) => z === ciudadNorm)) {
                  precioTotal = tarifa.precio_base || 0;
                  tarifaId = tarifa.id;
                  tarifaMetodo = 'zona';
                  break;
                }
              }
              // Pass 2: substring match (lower priority)
              if (precioTotal === 0) {
                for (const tarifa of zoneTarifas) {
                  if (!tarifa.zona_destino) continue;
                  const zonas = tarifa.zona_destino.split(',').map((z: string) => normalize(z.trim()));
                  if (zonas.some((z: string) => ciudadNorm.includes(z) || z.includes(ciudadNorm))) {
                    precioTotal = tarifa.precio_base || 0;
                    tarifaId = tarifa.id;
                    tarifaMetodo = 'zona';
                    break;
                  }
                }
              }

              if (precioTotal === 0) {
                const fallback = zoneTarifas
                  .filter(t => t.zona_destino && t.zona_destino.split(',').length > 3)
                  .sort((a, b) => (b.zona_destino?.split(',').length || 0) - (a.zona_destino?.split(',').length || 0))[0];
                if (fallback) {
                  precioTotal = fallback.precio_base || 0;
                  tarifaId = fallback.id;
                  tarifaMetodo = 'zona_fallback';
                }
              }
            }
          }

          // Fallback to seller tarifa
          if (precioTotal === 0 && seller.tarifa_id) {
            const { data: tarifa } = await supabase
              .from('tarifas')
              .select('precio_base')
              .eq('id', seller.tarifa_id)
              .single();
            if (tarifa?.precio_base) {
              precioTotal = tarifa.precio_base;
              tarifaId = seller.tarifa_id;
              tarifaMetodo = 'tarifa_seller';
            }
          }

          // Fecha entrega estimada from shipment
          const estimatedDelivery = shipment.shipping_option?.estimated_delivery_time?.date;
          const fechaEntregaEstimada = estimatedDelivery ? estimatedDelivery.substring(0, 10) : orderItem.date_created?.substring(0, 10);

          // Check if external_order_id already exists to avoid unique constraint violation
          const extOrderId = String(shipment.id);
          if (existingOrderSet.has(extOrderId)) {
            console.log(`[Recovery] Order already exists for shipment ${shipmentId}, skipping`);
            sellerSkipped++;
            continue;
          }

          // Create ecommerce_order
          const { data: ecomOrder, error: orderError } = await supabase
            .from('ecommerce_orders')
            .insert({
              seller_id: seller.id,
              tenant_id: seller.tenant_id,
              external_order_id: extOrderId,
              external_order_number: String(orderItem.id || shipment.id),
              plataforma: 'mercadolibre',
              ml_shipment_id: shipment.id,
              ml_tracking_number: trackingNumber,
              ml_shipping_status: 'delivered',
              buyer_name: receiverName,
              buyer_phone: receiverPhone,
              buyer_email: orderItem?.buyer?.email || null,
              shipping_address: address,
              shipping_city: city,
              shipping_province: state,
              shipping_postal_code: zipCode,
              shipping_lat: receiver.latitude || null,
              shipping_lng: receiver.longitude || null,
              items: orderItem?.order_items || [],
              shipping_cost: mlShippingCost,
              order_status: 'paid',
              fulfillment_status: 'fulfilled',
              raw_data: shipment,
              fecha_entrega_estimada: fechaEntregaEstimada,
              synced_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (orderError) {
            console.error(`[Recovery] Error creating order for ${shipmentId}:`, orderError);
            sellerErrors++;
            continue;
          }

          // Create envio with estado 'entregado'
          const { data: envio, error: envioError } = await supabase
            .from('envios')
            .insert({
              tenant_id: seller.tenant_id,
              tracking_number: trackingNumber,
              ml_shipment_id: shipment.id,
              ml_order_id: orderItem.id || null,
              ml_sync_status: 'synced',
              ml_last_sync_at: new Date().toISOString(),
              estado: 'entregado',
              estado_ml: 'entregado',
              nombre_destinatario: receiverName,
              direccion_entrega: address,
              ciudad_entrega: city,
              provincia: state,
              codigo_postal_destino: zipCode,
              entrega_lat: receiver.latitude || null,
              entrega_lng: receiver.longitude || null,
              whatsapp_destinatario: receiverPhone,
              precio_total: precioTotal,
              tarifa_id: tarifaId,
              tarifa_metodo_aplicado: tarifaMetodo,
              precio_flete_ml: mlShippingCost,
              tipo_servicio: 'express',
              tipo_servicio_detalle: 'ML Flex',
              sucursal_origen_id: seller.sucursal_pickup_id || null,
              nombre_remitente: seller.nombre,
              remitente_id: seller.cliente_id || null,
              pago_contra_entrega: false,
              descripcion: `Pedido ML Flex #${orderItem.id || shipment.id} (recuperado)`,
              fecha_entrega: shipment.status_history?.date_delivered || new Date().toISOString(),
            })
            .select()
            .single();

          if (envioError) {
            console.error(`[Recovery] Error creating envio for ${shipmentId}:`, envioError);
            await supabase.from('ecommerce_orders').delete().eq('id', ecomOrder.id);
            sellerErrors++;
            continue;
          }

          // Link order to envio
          await supabase.from('ecommerce_orders').update({ envio_id: envio.id }).eq('id', ecomOrder.id);

          // Create historial
          await supabase.from('envio_historial').insert({
            envio_id: envio.id,
            estado_nuevo: 'entregado',
            notas: `Envío recuperado desde ML API. Seller: ${seller.nombre}. Orden ML #${orderItem.id}`,
          });

          // Register cargo in cuenta corriente
          if (precioTotal > 0 && seller.tiene_cuenta_corriente) {
            const saldoAnterior = runningBalance;
            const saldoNuevo = saldoAnterior + precioTotal;

            await supabase.from('seller_cuenta_corriente').insert({
              seller_id: seller.id,
              tipo: 'cargo',
              monto: precioTotal,
              saldo_anterior: saldoAnterior,
              saldo_nuevo: saldoNuevo,
              descripcion: `Envío ML Flex ${trackingNumber} (recuperado)`,
              envio_id: envio.id,
            });

            runningBalance = saldoNuevo;
          }

          existingSet.add(shipmentId);
          existingOrderSet.add(extOrderId);
          sellerCreated++;
          console.log(`[Recovery] Created: ${trackingNumber} for ${seller.nombre}`);

        } catch (err) {
          console.error(`[Recovery] Error processing shipment ${shipmentId}:`, err);
          sellerErrors++;
        }
      }

      // Update seller balance if changed
      if (runningBalance !== (currentSeller?.saldo_cuenta_corriente || 0)) {
        await supabase.from('ecommerce_sellers')
          .update({ saldo_cuenta_corriente: runningBalance, updated_at: new Date().toISOString() })
          .eq('id', seller.id);
      }

      totalCreated += sellerCreated;
      totalSkipped += sellerSkipped;
      totalErrors += sellerErrors;
      results.push({
        seller: seller.nombre,
        store_id: seller.store_id,
        total_orders: allOrders.length,
        created: sellerCreated,
        skipped: sellerSkipped,
        errors: sellerErrors,
      });

      console.log(`[Recovery] ${seller.nombre}: created=${sellerCreated} skipped=${sellerSkipped} errors=${sellerErrors}`);
    }

    console.log(`[Recovery] DONE. Total created=${totalCreated} skipped=${totalSkipped} errors=${totalErrors}`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: { totalCreated, totalSkipped, totalErrors, sellersProcessed: sellers.length },
        details: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Recovery] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper: get valid access token, refresh if needed (tokens in ecommerce_seller_tokens)
async function getValidAccessToken(supabase: any, seller: any): Promise<string | null> {
  const { data: tokenRow } = await supabase
    .from('ecommerce_seller_tokens')
    .select('access_token, refresh_token, token_expires_at')
    .eq('seller_id', seller.id)
    .maybeSingle();

  const now = new Date();
  const expiresAt = tokenRow?.token_expires_at ? new Date(tokenRow.token_expires_at) : null;

  if (tokenRow?.access_token && expiresAt && expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return tokenRow.access_token;
  }

  if (!tokenRow?.refresh_token) {
    console.error('[Recovery] No refresh token for seller:', seller.nombre);
    return null;
  }

  console.log('[Recovery] Refreshing token for:', seller.nombre);

  const { data: credentials } = await supabase
    .from('system_integrations')
    .select('config_key, config_value')
    .eq('tenant_id', seller.tenant_id)
    .eq('integration_type', 'mercadolibre')
    .in('config_key', ['client_id', 'client_secret']);

  const config: Record<string, string> = {};
  for (const row of credentials || []) config[row.config_key] = row.config_value;

  if (!config.client_id || !config.client_secret) {
    console.error('[Recovery] Missing ML credentials for tenant');
    return null;
  }

  const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.client_id,
      client_secret: config.client_secret,
      refresh_token: tokenRow.refresh_token,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('[Recovery] Token refresh failed for', seller.nombre, ':', errorText);
    return null;
  }

  const tokenData = await tokenResponse.json();
  const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

  await supabase.from('ecommerce_seller_tokens').upsert({
    seller_id: seller.id,
    tenant_id: seller.tenant_id,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_expires_at: newExpiresAt.toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'seller_id' });

  await supabase
    .from('ecommerce_sellers')
    .update({ has_valid_token: true, updated_at: new Date().toISOString() })
    .eq('id', seller.id);

  console.log('[Recovery] Token refreshed for:', seller.nombre);
  return tokenData.access_token;
}

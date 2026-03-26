import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegisterRequest {
  ml_shipment_id: string;
  sender_id: string;
  user_id?: string; // Optional: user who is registering (for sucursal_origen)
  use_logistics_account?: boolean; // Flag to use generic logistics account
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { ml_shipment_id, sender_id, user_id, use_logistics_account }: RegisterRequest = await req.json();

    console.log('[register-ml-shipment] Request:', { ml_shipment_id, sender_id, user_id, use_logistics_account });

    if (!ml_shipment_id) {
      return new Response(
        JSON.stringify({ error: 'ml_shipment_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Find seller — try direct match first, then auto-fallback to logistics account
    let seller: any = null;
    let isLogisticsAccount = false;

    // Step A: try direct seller by store_id
    if (sender_id) {
      const { data: directSeller, error: sellerError } = await supabase
        .from('ecommerce_sellers')
        .select('*')
        .eq('store_id', sender_id)
        .eq('plataforma', 'mercadolibre')
        .maybeSingle();

      if (sellerError) {
        console.error('[register-ml-shipment] Seller lookup error:', sellerError);
      } else if (directSeller) {
        seller = directSeller;
        console.log('[register-ml-shipment] Found direct seller:', seller.nombre, seller.id);
      }
    }

    // Step B: no direct seller → auto-fallback to logistics account via user's tenant
    if (!seller && user_id) {
      console.log('[register-ml-shipment] No direct seller, looking for logistics account in user tenant...');

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user_id)
        .single();

      if (userProfile?.tenant_id) {
        const { data: logisticsSeller } = await supabase
          .from('ecommerce_sellers')
          .select('*')
          .eq('tenant_id', userProfile.tenant_id)
          .eq('es_cuenta_logistica', true)
          .eq('plataforma', 'mercadolibre')
          .eq('activo', true)
          .limit(1)
          .maybeSingle();

        if (logisticsSeller) {
          seller = logisticsSeller;
          isLogisticsAccount = true;
          console.log('[register-ml-shipment] Using logistics account:', seller.nombre, seller.id);
        } else {
          console.log('[register-ml-shipment] No logistics account found for tenant:', userProfile.tenant_id);
        }
      }
    }

    if (!seller) {
      return new Response(
        JSON.stringify({ error: 'No se encontró seller directo ni cuenta logística configurada para este tenant' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Check if access_token is valid, refresh if needed
    let accessToken = seller.access_token;
    const tokenExpiresAt = seller.token_expires_at ? new Date(seller.token_expires_at) : null;
    const now = new Date();

    if (!accessToken || (tokenExpiresAt && tokenExpiresAt < now)) {
      console.log('[register-ml-shipment] Token expired, refreshing...');
      
      // Get ML credentials from system_integrations
      const { data: credentials } = await supabase
        .from('system_integrations')
        .select('config_key, config_value')
        .eq('tenant_id', seller.tenant_id)
        .eq('integration_type', 'mercadolibre')
        .in('config_key', ['client_id', 'client_secret']);

      const credMap = Object.fromEntries((credentials || []).map(c => [c.config_key, c.config_value]));
      
      if (!credMap.client_id || !credMap.client_secret || !seller.refresh_token) {
        return new Response(
          JSON.stringify({ error: 'Seller sin credenciales válidas de MercadoLibre' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Refresh token
      const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: credMap.client_id,
          client_secret: credMap.client_secret,
          refresh_token: seller.refresh_token,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('[register-ml-shipment] Token refresh failed:', errorText);
        return new Response(
          JSON.stringify({ error: 'Error al renovar token de MercadoLibre' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;

      // Update seller tokens
      await supabase
        .from('ecommerce_sellers')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', seller.id);

      console.log('[register-ml-shipment] Token refreshed successfully');
    }

    // 3. Fetch shipment from ML API
    console.log('[register-ml-shipment] Fetching shipment from ML API:', ml_shipment_id);
    
    const shipmentResponse = await fetch(
      `https://api.mercadolibre.com/shipments/${ml_shipment_id}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!shipmentResponse.ok) {
      const errorText = await shipmentResponse.text();
      console.error('[register-ml-shipment] ML API error:', shipmentResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `Error al obtener envío de MercadoLibre: ${shipmentResponse.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mlShipment = await shipmentResponse.json();
    
    // Extract ML shipping cost - priority: lead_time.cost (documented), then fallbacks
    const mlShippingCost = mlShipment.lead_time?.cost 
      || mlShipment.shipping_option?.cost 
      || mlShipment.cost 
      || mlShipment.base_cost 
      || 0;

    // Extract delivery time frame and map to horario_preferido_entrega
    const timeFrame = mlShipment.lead_time?.estimated_delivery_time?.time_frame;
    let horarioPreferido = 'cualquier_hora';
    if (timeFrame && typeof timeFrame.from === 'number' && typeof timeFrame.to === 'number') {
      if (timeFrame.to <= 13) {
        horarioPreferido = 'manana';
      } else if (timeFrame.from >= 17) {
        horarioPreferido = 'noche';
      } else if (timeFrame.from >= 12) {
        horarioPreferido = 'tarde';
      }
    }
    console.log('[register-ml-shipment] Delivery time_frame:', JSON.stringify(timeFrame), '-> horario:', horarioPreferido);

    console.log('[register-ml-shipment] ML Shipment data:', {
      id: mlShipment.id,
      status: mlShipment.status,
      logistic_type: mlShipment.logistic_type,
      order_id: mlShipment.order_id,
      shipping_cost: mlShippingCost,
    });
    console.log('[register-ml-shipment] Full lead_time:', JSON.stringify(mlShipment.lead_time));

    // 4. Validate shipment type (must be Flex / self_service)
    if (mlShipment.logistic_type !== 'self_service') {
      return new Response(
        JSON.stringify({ 
          error: `Este envío no es de tipo Flex (logistic_type: ${mlShipment.logistic_type})`,
          logistic_type: mlShipment.logistic_type 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Check if shipment already exists
    const { data: existingShipment } = await supabase
      .from('envios')
      .select('id, tracking_number')
      .eq('ml_shipment_id', parseInt(ml_shipment_id))
      .maybeSingle();

    if (existingShipment) {
      return new Response(
        JSON.stringify({ 
          error: 'Este envío ya está registrado',
          envio: existingShipment 
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Extract receiver address
    const receiver = mlShipment.receiver_address || {};
    const receiverName = receiver.receiver_name || 'Destinatario ML';
    const street = receiver.address_line || receiver.street_name || '';
    const number = receiver.street_number || '';
    const city = receiver.city?.name || '';
    const state = receiver.state?.name || '';
    const zip = receiver.zip_code || '';
    const phone = receiver.receiver_phone || '';
    
    const fullAddress = [street, number].filter(Boolean).join(' ');

    // 7. Use ML shipment ID as tracking number (native ML tracking)
    const trackingNumber = `ML-${ml_shipment_id}`;

    console.log('[register-ml-shipment] Generated tracking:', trackingNumber);

    // 8. Get sucursal_origen from user's profile if user_id provided
    let sucursalOrigenId: string | null = null;
    if (user_id) {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('sucursal_id')
        .eq('user_id', user_id)
        .single();
      
      if (userProfile?.sucursal_id) {
        sucursalOrigenId = userProfile.sucursal_id;
        console.log('[register-ml-shipment] User sucursal_origen:', sucursalOrigenId);
      }
    }
    
    // Fallback to seller's pickup branch if no user branch (only for direct sellers)
    if (!sucursalOrigenId && !isLogisticsAccount && seller.sucursal_pickup_id) {
      sucursalOrigenId = seller.sucursal_pickup_id;
      console.log('[register-ml-shipment] Using seller pickup branch:', sucursalOrigenId);
    }

    // 9. Get rate for pricing - zone-based lookup
    let precioTotal = 0;
    let tarifaIdMatch: string | null = null;
    let tarifaMetodo: string | null = null;

    // For logistics account, skip seller-specific rate
    if (!isLogisticsAccount && seller.tarifa_id) {
      const { data: tarifa } = await supabase
        .from('tarifas')
        .select('id, precio_base')
        .eq('id', seller.tarifa_id)
        .single();
      
      if (tarifa) {
        precioTotal = tarifa.precio_base || 0;
        tarifaIdMatch = tarifa.id;
        tarifaMetodo = 'tarifa_seller';
      }
    }

    // If no seller rate or price is 0, try zone-based pricing
    if (precioTotal === 0 && city) {
      const tenantId = seller.tenant_id;
      const { data: zoneTarifas } = await supabase
        .from('tarifas')
        .select('id, precio_base, zona_destino')
        .eq('tenant_id', tenantId)
        .eq('tipo_tarifa', 'zona')
        .eq('activa', true);

      if (zoneTarifas && zoneTarifas.length > 0) {
        const normalize = (str: string) => str.toLowerCase().trim()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const ciudadNorm = normalize(city);

        // Pass 1: exact match (highest priority)
        for (const tarifa of zoneTarifas) {
          if (!tarifa.zona_destino) continue;
          const zonas = tarifa.zona_destino.split(',').map((z: string) => normalize(z.trim()));
          if (zonas.some((z: string) => z === ciudadNorm)) {
            precioTotal = tarifa.precio_base || 0;
            tarifaIdMatch = tarifa.id;
            tarifaMetodo = 'zona';
            console.log('[register-ml-shipment] Zone exact match:', tarifa.zona_destino, '-> precio:', precioTotal);
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
              tarifaIdMatch = tarifa.id;
              tarifaMetodo = 'zona';
              console.log('[register-ml-shipment] Zone substring match:', tarifa.zona_destino, '-> precio:', precioTotal);
              break;
            }
          }
        }

        // Fallback: use the broadest zone (most cities listed) as catch-all
        if (precioTotal === 0) {
          const fallback = zoneTarifas
            .filter(t => t.zona_destino && t.zona_destino.split(',').length > 3)
            .sort((a, b) => (b.zona_destino?.split(',').length || 0) - (a.zona_destino?.split(',').length || 0))[0];
          if (fallback) {
            precioTotal = fallback.precio_base || 0;
            tarifaIdMatch = fallback.id;
            tarifaMetodo = 'zona_fallback';
            console.log('[register-ml-shipment] Zone fallback applied:', fallback.zona_destino?.substring(0, 50), '-> precio:', precioTotal);
          } else {
            console.log('[register-ml-shipment] No zone match for city:', city);
          }
        }
      }
    }

    // 10. Calculate fecha_entrega_estimada based on Argentina time
    const nowArgReg = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const horaArgReg = nowArgReg.getUTCHours();
    let fechaEntregaEstimadaReg: string;
    if (horaArgReg >= 12) {
      const tomorrow = new Date(nowArgReg);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      fechaEntregaEstimadaReg = tomorrow.toISOString().substring(0, 10);
    } else {
      fechaEntregaEstimadaReg = nowArgReg.toISOString().substring(0, 10);
    }

    // 11. Create ecommerce_order ONLY for direct sellers (not logistics account)
    let ecommerceOrderId: string | null = null;
    if (!isLogisticsAccount) {
      const { data: ecommerceOrder, error: orderError } = await supabase
        .from('ecommerce_orders')
        .insert({
          seller_id: seller.id,
          tenant_id: seller.tenant_id,
          plataforma: 'mercadolibre',
          external_order_id: String(mlShipment.order_id || ml_shipment_id),
          external_order_number: String(mlShipment.order_id || ml_shipment_id),
          buyer_name: receiverName,
          buyer_phone: phone,
          shipping_address: fullAddress,
          shipping_city: city,
          shipping_province: state,
          shipping_postal_code: zip,
          shipping_lat: receiver.latitude,
          shipping_lng: receiver.longitude,
          order_status: 'pending',
          fulfillment_status: 'pending',
          ml_shipment_id: parseInt(ml_shipment_id),
          ml_tracking_number: trackingNumber,
          synced_at: new Date().toISOString(),
          raw_data: mlShipment,
          shipping_cost: mlShippingCost,
          fecha_entrega_estimada: fechaEntregaEstimadaReg,
        })
        .select()
        .single();

      if (orderError) {
        console.error('[register-ml-shipment] Order creation error:', orderError);
        return new Response(
          JSON.stringify({ error: 'Error al crear orden ecommerce' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      ecommerceOrderId = ecommerceOrder.id;
      console.log('[register-ml-shipment] Created ecommerce_order:', ecommerceOrderId);
    } else {
      console.log('[register-ml-shipment] Logistics account — skipping ecommerce_order creation');
    }

    // 12. Create envio
    const { data: envio, error: envioError } = await supabase
      .from('envios')
      .insert({
        tenant_id: seller.tenant_id,
        tracking_number: trackingNumber,
        ml_shipment_id: parseInt(ml_shipment_id),
        ml_order_id: mlShipment.order_id,
        ml_sync_status: 'synced',
        ml_last_sync_at: new Date().toISOString(),
        estado: 'pendiente',
        nombre_destinatario: receiverName,
        direccion_entrega: fullAddress,
        ciudad_entrega: city,
        provincia: state,
        codigo_postal_destino: zip,
        whatsapp_destinatario: phone,
        entrega_lat: receiver.latitude,
        entrega_lng: receiver.longitude,
        precio_total: precioTotal,
        precio_tarifa_vigente: precioTotal,
        tarifa_id: tarifaIdMatch || (!isLogisticsAccount ? seller.tarifa_id : null),
        tarifa_metodo_aplicado: tarifaMetodo,
        tipo_servicio: 'express',
        tipo_servicio_detalle: 'ML Flex',
        horario_preferido_entrega: horarioPreferido,
        pago_contra_entrega: false,
        descripcion: `Pedido MercadoLibre Flex #${mlShipment.order_id || ml_shipment_id}${isLogisticsAccount ? ' (cuenta logística)' : ''}`,
        sucursal_origen_id: sucursalOrigenId,
        precio_flete_ml: mlShippingCost,
        nombre_remitente: isLogisticsAccount ? `ML Seller ${sender_id}` : seller.nombre,
        remitente_id: !isLogisticsAccount ? (seller.cliente_id || null) : null,
      })
      .select()
      .single();

    if (envioError) {
      console.error('[register-ml-shipment] Envio creation error:', envioError);
      // Cleanup: delete the ecommerce_order we just created
      if (ecommerceOrderId) {
        await supabase.from('ecommerce_orders').delete().eq('id', ecommerceOrderId);
      }
      return new Response(
        JSON.stringify({ error: 'Error al crear envío' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[register-ml-shipment] Created envio:', envio.id, envio.tracking_number, 'sucursal_origen:', sucursalOrigenId, 'logistics_account:', isLogisticsAccount);

    // 13. Link ecommerce_order to envio (only for direct sellers)
    if (ecommerceOrderId) {
      await supabase
        .from('ecommerce_orders')
        .update({ envio_id: envio.id })
        .eq('id', ecommerceOrderId);
    }

    // 14. Record charge in seller's account if applicable (only for direct sellers)
    if (!isLogisticsAccount && precioTotal > 0 && seller.tiene_cuenta_corriente) {
      const { data: currentBalance } = await supabase
        .from('ecommerce_sellers')
        .select('saldo_cuenta_corriente')
        .eq('id', seller.id)
        .single();

      const saldoAnterior = currentBalance?.saldo_cuenta_corriente || 0;
      const saldoNuevo = saldoAnterior + precioTotal;

      await supabase.from('seller_cuenta_corriente').insert({
        seller_id: seller.id,
        tipo: 'cargo',
        monto: precioTotal,
        saldo_anterior: saldoAnterior,
        saldo_nuevo: saldoNuevo,
        descripcion: `Envío ML Flex ${trackingNumber}`,
        envio_id: envio.id,
      });

      console.log('[register-ml-shipment] Recorded charge:', precioTotal);
    }

    // 15. Create history entry
    await supabase.from('envio_historial').insert({
      envio_id: envio.id,
      estado_nuevo: 'pendiente',
      notas: isLogisticsAccount 
        ? `Envío registrado desde escaneo QR ML Flex via cuenta logística (${seller.nombre}). Seller original: ${sender_id}`
        : `Envío registrado desde escaneo QR ML Flex. Seller: ${seller.nombre}${sucursalOrigenId ? ' (con sucursal origen)' : ''}`,
    });

    console.log('[register-ml-shipment] Success! Envio:', envio.tracking_number);

    return new Response(
      JSON.stringify({
        success: true,
        envio: {
          id: envio.id,
          tracking_number: envio.tracking_number,
          ml_shipment_id: envio.ml_shipment_id,
          estado: envio.estado,
          nombre_destinatario: envio.nombre_destinatario,
          direccion_entrega: envio.direccion_entrega,
          ciudad_entrega: envio.ciudad_entrega,
          whatsapp_destinatario: envio.whatsapp_destinatario,
          precio_total: envio.precio_total,
        },
        seller: {
          id: seller.id,
          nombre: seller.nombre,
          is_logistics_account: isLogisticsAccount,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[register-ml-shipment] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

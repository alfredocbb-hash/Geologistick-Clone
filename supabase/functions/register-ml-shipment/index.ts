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

    const { ml_shipment_id, sender_id, user_id }: RegisterRequest = await req.json();

    console.log('[register-ml-shipment] Request:', { ml_shipment_id, sender_id, user_id });

    if (!ml_shipment_id || !sender_id) {
      return new Response(
        JSON.stringify({ error: 'ml_shipment_id and sender_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Find seller by store_id
    const { data: seller, error: sellerError } = await supabase
      .from('ecommerce_sellers')
      .select('*')
      .eq('store_id', sender_id)
      .eq('plataforma', 'mercadolibre')
      .maybeSingle();

    if (sellerError) {
      console.error('[register-ml-shipment] Seller lookup error:', sellerError);
      return new Response(
        JSON.stringify({ error: 'Error al buscar seller' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!seller) {
      return new Response(
        JSON.stringify({ error: `Seller con store_id ${sender_id} no encontrado` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[register-ml-shipment] Found seller:', seller.nombre, seller.id);

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
    
    // Fallback to seller's pickup branch if no user branch
    if (!sucursalOrigenId && seller.sucursal_pickup_id) {
      sucursalOrigenId = seller.sucursal_pickup_id;
      console.log('[register-ml-shipment] Using seller pickup branch:', sucursalOrigenId);
    }

    // 9. Get seller's rate for pricing
    let precioTotal = 0;
    if (seller.tarifa_id) {
      const { data: tarifa } = await supabase
        .from('tarifas')
        .select('precio_base')
        .eq('id', seller.tarifa_id)
        .single();
      
      if (tarifa) {
        precioTotal = tarifa.precio_base || 0;
      }
    }

    // 10. Create ecommerce_order
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

    console.log('[register-ml-shipment] Created ecommerce_order:', ecommerceOrder.id);

    // 11. Create envio with ORIGINAL ml_shipment_id and sucursal_origen
    const { data: envio, error: envioError } = await supabase
      .from('envios')
      .insert({
        tenant_id: seller.tenant_id,
        tracking_number: trackingNumber,
        ml_shipment_id: parseInt(ml_shipment_id), // Original ID from QR
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
          tarifa_id: seller.tarifa_id,
          tipo_servicio: 'express',
          tipo_servicio_detalle: 'ML Flex',
          pago_contra_entrega: false,
          descripcion: `Pedido MercadoLibre Flex #${mlShipment.order_id || ml_shipment_id}`,
          sucursal_origen_id: sucursalOrigenId, // Track who did the pickup
          precio_flete_ml: mlShippingCost, // ML shipping rate from API
          nombre_remitente: seller.nombre,
          remitente_id: seller.cliente_id || null,
      })
      .select()
      .single();

    if (envioError) {
      console.error('[register-ml-shipment] Envio creation error:', envioError);
      // Cleanup: delete the ecommerce_order we just created
      await supabase.from('ecommerce_orders').delete().eq('id', ecommerceOrder.id);
      return new Response(
        JSON.stringify({ error: 'Error al crear envío' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[register-ml-shipment] Created envio:', envio.id, envio.tracking_number, 'sucursal_origen:', sucursalOrigenId);

    // 12. Link ecommerce_order to envio
    await supabase
      .from('ecommerce_orders')
      .update({ envio_id: envio.id })
      .eq('id', ecommerceOrder.id);

    // 13. Record charge in seller's account if applicable
    if (precioTotal > 0 && seller.tiene_cuenta_corriente) {
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

    // 14. Create history entry
    await supabase.from('envio_historial').insert({
      envio_id: envio.id,
      estado_nuevo: 'pendiente',
      notas: `Envío registrado desde escaneo QR ML Flex. Seller: ${seller.nombre}${sucursalOrigenId ? ' (con sucursal origen)' : ''}`,
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

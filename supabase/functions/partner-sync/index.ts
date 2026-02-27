import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function notifyTenantAdmins(
  serviceClient: any,
  tenantId: string,
  titulo: string,
  mensaje: string,
  tipo: string = 'partnership'
) {
  try {
    // Get admin user_ids for this tenant
    const { data: admins } = await serviceClient
      .from('profiles')
      .select('user_id, user_roles!inner(role)')
      .eq('tenant_id', tenantId)
      .in('user_roles.role', ['admin', 'super_admin'])

    if (!admins || admins.length === 0) return

    const notifications = admins.map((admin: any) => ({
      user_id: admin.user_id,
      titulo,
      mensaje,
      tipo,
      leida: false,
    }))

    await serviceClient.from('notifications').insert(notifications)
  } catch (e) {
    console.error('Error sending partner notifications:', e)
  }
}

async function getTenantName(serviceClient: any, tenantId: string): Promise<string> {
  const { data } = await serviceClient
    .from('tenants')
    .select('nombre')
    .eq('id', tenantId)
    .single()
  return data?.nombre || 'Empresa'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const userId = claimsData.claims.sub
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get user's tenant
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', userId)
      .single()

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: 'Tenant no encontrado' }), { status: 400, headers: corsHeaders })
    }

    const tenantId = profile.tenant_id
    const body = await req.json()
    const { action } = body

    switch (action) {
      case 'search_tenants': {
        const { query } = body
        const { data, error } = await serviceClient
          .from('tenants')
          .select('id, nombre, slug')
          .neq('id', tenantId)
          .eq('activo', true)
          .or(`nombre.ilike.%${query}%,slug.ilike.%${query}%`)
          .limit(10)

        if (error) throw error
        return new Response(JSON.stringify({ tenants: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'request_partnership': {
        const { target_tenant_id, permisos, notas } = body

        // Ensure alphabetical order for unique constraint
        const [tA, tB] = [tenantId, target_tenant_id].sort()

        const { data, error } = await serviceClient
          .from('tenant_partners')
          .insert({
            tenant_a_id: tA,
            tenant_b_id: tB,
            estado: 'pendiente',
            permisos: permisos || { puede_derivar: true, puede_ver_precio: false, puede_ver_cliente: true, puede_cambiar_estado: false },
            notas,
            solicitado_por: tenantId,
          })
          .select()
          .single()

        if (error) throw error

        // Log event
        await serviceClient.from('partner_events').insert({
          partnership_id: data.id,
          evento: 'solicitud_enviada',
          datos: { solicitado_por: tenantId, target: target_tenant_id },
          created_by: userId,
          tenant_id: tenantId,
        })

        // Notify target tenant admins
        const senderName = await getTenantName(serviceClient, tenantId)
        await notifyTenantAdmins(
          serviceClient,
          target_tenant_id,
          'Nueva solicitud de asociación',
          `${senderName} quiere asociarse con tu empresa. Revisá la solicitud en Empresas Asociadas.`,
          'partnership'
        )

        return new Response(JSON.stringify({ partnership: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'respond_partnership': {
        const { partnership_id, accept } = body
        const newStatus = accept ? 'activa' : 'cancelada'

        const { data, error } = await serviceClient
          .from('tenant_partners')
          .update({ estado: newStatus })
          .eq('id', partnership_id)
          .or(`tenant_a_id.eq.${tenantId},tenant_b_id.eq.${tenantId}`)
          .select()
          .single()

        if (error) throw error

        await serviceClient.from('partner_events').insert({
          partnership_id: data.id,
          evento: accept ? 'solicitud_aceptada' : 'solicitud_rechazada',
          datos: { respondido_por: tenantId },
          created_by: userId,
          tenant_id: tenantId,
        })

        // Notify the other tenant
        const otherTenantId = data.tenant_a_id === tenantId ? data.tenant_b_id : data.tenant_a_id
        const responderName = await getTenantName(serviceClient, tenantId)
        await notifyTenantAdmins(
          serviceClient,
          otherTenantId,
          accept ? 'Asociación aceptada' : 'Asociación rechazada',
          accept
            ? `${responderName} aceptó tu solicitud de asociación. Ya podés derivar envíos.`
            : `${responderName} rechazó tu solicitud de asociación.`,
          'partnership'
        )

        return new Response(JSON.stringify({ partnership: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'derive_shipment': {
        const { partnership_id, envio_id, target_tenant_id } = body

        // Verify partnership is active
        const { data: partnership } = await serviceClient
          .from('tenant_partners')
          .select('*')
          .eq('id', partnership_id)
          .eq('estado', 'activa')
          .single()

        if (!partnership) {
          return new Response(JSON.stringify({ error: 'Partnership no activa' }), { status: 400, headers: corsHeaders })
        }

        // Get shipment data
        const { data: envio } = await serviceClient
          .from('envios')
          .select('*')
          .eq('id', envio_id)
          .eq('tenant_id', tenantId)
          .single()

        if (!envio) {
          return new Response(JSON.stringify({ error: 'Envío no encontrado' }), { status: 404, headers: corsHeaders })
        }

        // Create partner_shipment with metadata
        const metadata = {
          tracking_origen: envio.tracking_number,
          nombre_destinatario: envio.nombre_destinatario,
          direccion_entrega: envio.direccion_entrega,
          ciudad_entrega: envio.ciudad_entrega,
          cp_entrega: envio.cp_entrega,
          provincia: envio.provincia,
          whatsapp_destinatario: envio.whatsapp_destinatario,
          peso_kg: envio.peso_kg,
          descripcion: envio.descripcion,
          precio_total: partnership.permisos?.puede_ver_precio ? envio.precio_total : null,
          nombre_remitente: partnership.permisos?.puede_ver_cliente ? envio.nombre_remitente : null,
        }

        const { data: partnerShipment, error: psError } = await serviceClient
          .from('partner_shipments')
          .insert({
            partnership_id,
            envio_origen_id: envio_id,
            tenant_origen_id: tenantId,
            tenant_destino_id: target_tenant_id,
            estado_sync: 'pendiente',
            metadata,
          })
          .select()
          .single()

        if (psError) throw psError

        // Log event
        await serviceClient.from('partner_events').insert({
          partnership_id,
          partner_shipment_id: partnerShipment.id,
          evento: 'envio_derivado',
          datos: { envio_id, tracking: envio.tracking_number },
          created_by: userId,
          tenant_id: tenantId,
        })

        // Notify target tenant
        const deriverName = await getTenantName(serviceClient, tenantId)
        await notifyTenantAdmins(
          serviceClient,
          target_tenant_id,
          'Nuevo envío derivado',
          `${deriverName} te derivó el envío ${envio.tracking_number}. Revisalo en Empresas Asociadas.`,
          'partnership'
        )

        return new Response(JSON.stringify({ partner_shipment: partnerShipment }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'accept_shipment': {
        const { partner_shipment_id, sucursal_destino_id } = body

        // Get partner shipment
        const { data: ps } = await serviceClient
          .from('partner_shipments')
          .select('*, partnership:tenant_partners(*)')
          .eq('id', partner_shipment_id)
          .eq('tenant_destino_id', tenantId)
          .eq('estado_sync', 'pendiente')
          .single()

        if (!ps) {
          return new Response(JSON.stringify({ error: 'Envío no encontrado o ya procesado' }), { status: 404, headers: corsHeaders })
        }

        const meta = ps.metadata as any

        // Get a default branch if not provided
        let branchId = sucursal_destino_id
        if (!branchId) {
          const { data: branches } = await serviceClient
            .from('sucursales')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('activa', true)
            .limit(1)
          branchId = branches?.[0]?.id
        }

        // Create a new shipment in the destination tenant
        const { data: newEnvio, error: envioError } = await serviceClient
          .from('envios')
          .insert({
            tenant_id: tenantId,
            tracking_number: `PRT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            tracking_externo: meta.tracking_origen,
            nombre_destinatario: meta.nombre_destinatario,
            direccion_entrega: meta.direccion_entrega,
            ciudad_entrega: meta.ciudad_entrega,
            cp_entrega: meta.cp_entrega,
            provincia: meta.provincia,
            whatsapp_destinatario: meta.whatsapp_destinatario,
            peso_kg: meta.peso_kg,
            descripcion: meta.descripcion || 'Envío derivado de partner',
            precio_total: 0,
            estado: 'pendiente',
            sucursal_destino_id: branchId,
            notas: `Derivado de partner. Tracking origen: ${meta.tracking_origen}`,
          })
          .select()
          .single()

        if (envioError) throw envioError

        // Update partner_shipment
        await serviceClient
          .from('partner_shipments')
          .update({
            estado_sync: 'aceptado',
            envio_destino_id: newEnvio.id,
          })
          .eq('id', partner_shipment_id)

        // Log event
        await serviceClient.from('partner_events').insert({
          partnership_id: ps.partnership_id,
          partner_shipment_id: ps.id,
          evento: 'envio_aceptado',
          datos: { envio_destino_id: newEnvio.id, tracking: newEnvio.tracking_number },
          created_by: userId,
          tenant_id: tenantId,
        })

        // Notify origin tenant
        const accepterName = await getTenantName(serviceClient, tenantId)
        await notifyTenantAdmins(
          serviceClient,
          ps.tenant_origen_id,
          'Envío derivado aceptado',
          `${accepterName} aceptó el envío ${meta.tracking_origen}. Tracking destino: ${newEnvio.tracking_number}.`,
          'partnership'
        )

        return new Response(JSON.stringify({ envio: newEnvio }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'reject_shipment': {
        const { partner_shipment_id } = body

        // Get data before updating
        const { data: ps } = await serviceClient
          .from('partner_shipments')
          .select('partnership_id, tenant_origen_id, metadata')
          .eq('id', partner_shipment_id)
          .eq('tenant_destino_id', tenantId)
          .single()

        const { error } = await serviceClient
          .from('partner_shipments')
          .update({ estado_sync: 'rechazado' })
          .eq('id', partner_shipment_id)
          .eq('tenant_destino_id', tenantId)

        if (error) throw error

        if (ps) {
          await serviceClient.from('partner_events').insert({
            partnership_id: ps.partnership_id,
            partner_shipment_id,
            evento: 'envio_rechazado',
            datos: { rechazado_por: tenantId },
            created_by: userId,
            tenant_id: tenantId,
          })

          // Notify origin tenant
          const rejecterName = await getTenantName(serviceClient, tenantId)
          const meta = ps.metadata as any
          await notifyTenantAdmins(
            serviceClient,
            ps.tenant_origen_id,
            'Envío derivado rechazado',
            `${rejecterName} rechazó el envío ${meta?.tracking_origen || ''}. Revisá alternativas en Empresas Asociadas.`,
            'partnership'
          )
        }

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      default:
        return new Response(JSON.stringify({ error: 'Acción no válida' }), { status: 400, headers: corsHeaders })
    }
  } catch (error: any) {
    console.error('partner-sync error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
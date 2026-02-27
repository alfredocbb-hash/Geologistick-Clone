import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export function usePartners() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = profile?.tenant_id;

  const partnershipsQuery = useQuery({
    queryKey: ['partnerships', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('tenant_partners')
        .select('*')
        .or(`tenant_a_id.eq.${tenantId},tenant_b_id.eq.${tenantId}`)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch tenant names for display
      const tenantIds = new Set<string>();
      data?.forEach(p => {
        tenantIds.add(p.tenant_a_id);
        tenantIds.add(p.tenant_b_id);
      });
      tenantIds.delete(tenantId);

      let tenantMap: Record<string, string> = {};
      if (tenantIds.size > 0) {
        const { data: tenants } = await supabase
          .from('tenants')
          .select('id, nombre')
          .in('id', [...tenantIds]);
        tenantMap = Object.fromEntries((tenants || []).map(t => [t.id, t.nombre]));
      }

      return (data || []).map(p => {
        const partnerId = p.tenant_a_id === tenantId ? p.tenant_b_id : p.tenant_a_id;
        const isPending = p.estado === 'pendiente' && p.solicitado_por !== tenantId;
        return { ...p, partner_tenant_id: partnerId, partner_name: tenantMap[partnerId] || 'Empresa', is_incoming_request: isPending };
      });
    },
    enabled: !!tenantId,
  });

  const activePartnerships = partnershipsQuery.data?.filter(p => p.estado === 'activa') || [];

  const searchTenants = useMutation({
    mutationFn: async (query: string) => {
      const { data, error } = await supabase.functions.invoke('partner-sync', {
        body: { action: 'search_tenants', query },
      });
      if (error) throw error;
      return data.tenants || [];
    },
  });

  const requestPartnership = useMutation({
    mutationFn: async ({ targetTenantId, notas }: { targetTenantId: string; notas?: string }) => {
      const { data, error } = await supabase.functions.invoke('partner-sync', {
        body: { action: 'request_partnership', target_tenant_id: targetTenantId, notas },
      });
      if (error) throw error;
      return data.partnership;
    },
    onSuccess: () => {
      toast.success('Solicitud de partnership enviada');
      queryClient.invalidateQueries({ queryKey: ['partnerships'] });
    },
    onError: (e: any) => toast.error(e.message || 'Error al enviar solicitud'),
  });

  const respondPartnership = useMutation({
    mutationFn: async ({ partnershipId, accept }: { partnershipId: string; accept: boolean }) => {
      const { data, error } = await supabase.functions.invoke('partner-sync', {
        body: { action: 'respond_partnership', partnership_id: partnershipId, accept },
      });
      if (error) throw error;
      return data.partnership;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.accept ? 'Partnership aceptada' : 'Partnership rechazada');
      queryClient.invalidateQueries({ queryKey: ['partnerships'] });
    },
    onError: (e: any) => toast.error(e.message || 'Error al responder'),
  });

  const deriveShipment = useMutation({
    mutationFn: async ({ partnershipId, envioId, targetTenantId }: { partnershipId: string; envioId: string; targetTenantId: string }) => {
      const { data, error } = await supabase.functions.invoke('partner-sync', {
        body: { action: 'derive_shipment', partnership_id: partnershipId, envio_id: envioId, target_tenant_id: targetTenantId },
      });
      if (error) throw error;
      return data.partner_shipment;
    },
    onSuccess: () => {
      toast.success('Envío derivado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['partner-shipments'] });
    },
    onError: (e: any) => toast.error(e.message || 'Error al derivar envío'),
  });

  const incomingShipmentsQuery = useQuery({
    queryKey: ['partner-shipments-incoming', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('partner_shipments')
        .select('*')
        .eq('tenant_destino_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const acceptShipment = useMutation({
    mutationFn: async ({ partnerShipmentId, sucursalDestinoId }: { partnerShipmentId: string; sucursalDestinoId?: string }) => {
      const { data, error } = await supabase.functions.invoke('partner-sync', {
        body: { action: 'accept_shipment', partner_shipment_id: partnerShipmentId, sucursal_destino_id: sucursalDestinoId },
      });
      if (error) throw error;
      return data.envio;
    },
    onSuccess: () => {
      toast.success('Envío aceptado y creado en tu sistema');
      queryClient.invalidateQueries({ queryKey: ['partner-shipments-incoming'] });
      queryClient.invalidateQueries({ queryKey: ['envios'] });
    },
    onError: (e: any) => toast.error(e.message || 'Error al aceptar envío'),
  });

  const rejectShipment = useMutation({
    mutationFn: async (partnerShipmentId: string) => {
      const { data, error } = await supabase.functions.invoke('partner-sync', {
        body: { action: 'reject_shipment', partner_shipment_id: partnerShipmentId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Envío rechazado');
      queryClient.invalidateQueries({ queryKey: ['partner-shipments-incoming'] });
    },
    onError: (e: any) => toast.error(e.message || 'Error al rechazar envío'),
  });

  return {
    partnerships: partnershipsQuery.data || [],
    activePartnerships,
    isLoading: partnershipsQuery.isLoading,
    searchTenants,
    requestPartnership,
    respondPartnership,
    deriveShipment,
    incomingShipments: incomingShipmentsQuery.data || [],
    incomingShipmentsLoading: incomingShipmentsQuery.isLoading,
    acceptShipment,
    rejectShipment,
  };
}

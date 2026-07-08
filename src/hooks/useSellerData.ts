import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface SellerData {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
  provincia: string | null;
  plataforma: string;
  store_url: string | null;
  tiene_cuenta_corriente: boolean;
  saldo_cuenta_corriente: number;
  limite_credito: number;
  activo: boolean;
  tenant_id: string;
  tarifa_id: string | null;
  sucursal_pickup_id: string | null;
}

export interface SellerMovement {
  id: string;
  tipo: string;
  monto: number;
  saldo_anterior: number;
  saldo_nuevo: number;
  descripcion: string | null;
  referencia: string | null;
  created_at: string;
}

export function useSellerData() {
  const { user } = useAuth();

  const { data: seller, isLoading: isLoadingSeller, error: sellerError } = useQuery({
    queryKey: ['seller-data', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('ecommerce_sellers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as SellerData | null;
    },
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });


  const { data: movements, isLoading: isLoadingMovements } = useQuery({
    queryKey: ['seller-movements', seller?.id],
    queryFn: async () => {
      if (!seller?.id) return [];
      
      const { data, error } = await supabase
        .from('seller_cuenta_corriente')
        .select('*')
        .eq('seller_id', seller.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as SellerMovement[];
    },
    enabled: !!seller?.id && seller.tiene_cuenta_corriente,
  });

  const { data: ordersCount } = useQuery({
    queryKey: ['seller-orders-count', seller?.id],
    queryFn: async () => {
      if (!seller?.id) return { pending: 0, total: 0 };
      
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { count: pending } = await supabase
        .from('ecommerce_orders')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', seller.id)
        .eq('fulfillment_status', 'pending');
      
      const { count: total } = await supabase
        .from('ecommerce_orders')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', seller.id)
        .gte('created_at', startOfMonth.toISOString());
      
      return { pending: pending || 0, total: total || 0 };
    },
    enabled: !!seller?.id,
  });

  const { data: shipmentsInTransit } = useQuery({
    queryKey: ['seller-shipments-transit', seller?.id],
    queryFn: async () => {
      if (!seller?.id) return 0;
      
      const { count } = await supabase
        .from('envios')
        .select('*', { count: 'exact', head: true })
        .eq('remitente_id', seller.id)
        .in('estado', ['en_transito', 'en_reparto']);
      
      return count || 0;
    },
    enabled: !!seller?.id,
  });

  return {
    seller,
    movements: movements || [],
    ordersCount: ordersCount || { pending: 0, total: 0 },
    shipmentsInTransit: shipmentsInTransit || 0,
    isLoading: isLoadingSeller,
    isLoadingMovements,
    error: sellerError,
  };
}

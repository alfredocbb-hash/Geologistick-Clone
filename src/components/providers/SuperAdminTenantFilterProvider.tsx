import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export type TenantFilterValue = string | 'all';

interface TenantOption {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
}

interface SuperAdminTenantFilterContextType {
  selectedTenantId: TenantFilterValue;
  setSelectedTenantId: (id: TenantFilterValue) => void;
  selectedTenant: TenantOption | null;
  tenants: TenantOption[];
  isLoading: boolean;
  enabled: boolean;
}

const Ctx = createContext<SuperAdminTenantFilterContextType>({
  selectedTenantId: 'all',
  setSelectedTenantId: () => {},
  selectedTenant: null,
  tenants: [],
  isLoading: false,
  enabled: false,
});

const STORAGE_KEY = 'sa_selected_tenant';

export function useSuperAdminTenantFilter() {
  return useContext(Ctx);
}

export function SuperAdminTenantFilterProvider({ children }: { children: ReactNode }) {
  const { isSuperAdmin } = useAuth();
  const enabled = isSuperAdmin();
  const queryClient = useQueryClient();

  const [selectedTenantId, setSelectedTenantIdState] = useState<TenantFilterValue>(() => {
    if (typeof window === 'undefined') return 'all';
    return (localStorage.getItem(STORAGE_KEY) as TenantFilterValue) || 'all';
  });

  const setSelectedTenantId = useCallback(
    (id: TenantFilterValue) => {
      setSelectedTenantIdState(id);
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {/* ignore */}
      // Invalidate all queries so they refetch with new tenant filter
      queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['sa-tenants-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, nombre, slug, activo')
        .order('nombre');
      if (error) throw error;
      return data as TenantOption[];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const selectedTenant =
    selectedTenantId === 'all'
      ? null
      : tenants.find(t => t.id === selectedTenantId) || null;

  return (
    <Ctx.Provider
      value={{
        selectedTenantId,
        setSelectedTenantId,
        selectedTenant,
        tenants,
        isLoading,
        enabled,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

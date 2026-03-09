import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface RolePermission {
  id: string;
  role: AppRole;
  permission_key: string;
  permission_name: string;
  description: string | null;
  enabled: boolean;
}

export function usePermissions() {
  const { roles, isSuperAdmin } = useAuth();

  // Fetch permissions for user's roles
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['user-permissions', roles],
    queryFn: async () => {
      if (!roles || roles.length === 0) return [];
      
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .in('role', roles)
        .eq('enabled', true);
      
      if (error) throw error;
      return data as RolePermission[];
    },
    enabled: roles.length > 0,
    refetchOnWindowFocus: false,
  });

  // Check if user has a specific permission
  const hasPermission = (permissionKey: string): boolean => {
    // Super admin has all permissions
    if (isSuperAdmin()) return true;
    
    // Check if any of user's roles has this permission enabled
    return permissions.some(p => p.permission_key === permissionKey && p.enabled);
  };

  // Get all enabled permission keys for the user
  const getEnabledPermissions = (): string[] => {
    if (isSuperAdmin()) {
      // Return all possible permissions for super admin
      return permissions.map(p => p.permission_key);
    }
    return permissions.filter(p => p.enabled).map(p => p.permission_key);
  };

  return {
    permissions,
    isLoading,
    hasPermission,
    getEnabledPermissions,
  };
}

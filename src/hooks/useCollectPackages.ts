import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export interface CollectPackage {
  id: string;
  tracking_number: string;
  direccion_entrega: string | null;
  nombre_destinatario: string | null;
  estado: string | null;
}

const STORAGE_KEY = 'collect-packages';

export function useCollectPackages() {
  const { user, profile } = useAuth();
  const [packages, setPackages] = useState<CollectPackage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const packagesRef = useRef<CollectPackage[]>([]);

  // Keep ref in sync with state
  useEffect(() => { packagesRef.current = packages; }, [packages]);

  // Load from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setPackages(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading collect packages:', e);
      }
    }
  }, []);

  // Save to sessionStorage whenever packages change
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(packages));
  }, [packages]);

  const addPackageByTracking = useCallback(async (tracking: string): Promise<CollectPackage | null> => {
    if (!user?.id) return null;

    // Check if already added (use ref to avoid stale closure)
    if (packagesRef.current.some(p => p.tracking_number === tracking)) {
      toast.info('Este paquete ya está en la lista');
      return null;
    }

    setIsLoading(true);
    try {
      const tenantId = (profile as any)?.tenant_id;

      // Primary search: case-insensitive exact match
      let envio: any = null;
      const { data } = await supabase
        .from('envios')
        .select('id, tracking_number, direccion_entrega, nombre_destinatario, estado')
        .ilike('tracking_number', tracking)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      envio = data;

      // Fallback: try removing suffix
      if (!envio) {
        const baseTracking = tracking.replace(/-\d{1,2}$/, '');
        if (baseTracking !== tracking) {
          const { data: fallback } = await supabase
            .from('envios')
            .select('id, tracking_number, direccion_entrega, nombre_destinatario, estado')
            .ilike('tracking_number', baseTracking)
            .eq('tenant_id', tenantId)
            .maybeSingle();
          envio = fallback;
        }
      }

      if (!envio) return null;

      // Check duplicate by id (use ref to avoid stale closure)
      if (packagesRef.current.some(p => p.id === envio.id)) {
        toast.info('Este paquete ya está en la lista');
        return null;
      }

      const pkg: CollectPackage = {
        id: envio.id,
        tracking_number: envio.tracking_number,
        direccion_entrega: envio.direccion_entrega,
        nombre_destinatario: envio.nombre_destinatario,
        estado: envio.estado,
      };

      setPackages(prev => [...prev, pkg]);
      toast.success('Paquete agregado', { description: envio.tracking_number });
      return pkg;
    } catch (error: any) {
      console.error('Error adding collect package:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, profile]);

  const removePackage = useCallback((id: string) => {
    setPackages(prev => prev.filter(p => p.id !== id));
    toast.info('Paquete removido');
  }, []);

  const clearPackages = useCallback(() => {
    setPackages([]);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const confirmCollection = useCallback(async (): Promise<boolean> => {
    if (!user?.id || packages.length === 0) {
      toast.error('No hay paquetes para confirmar');
      return false;
    }

    setIsLoading(true);
    try {
      const envioIds = packages.map(p => p.id);
      const now = new Date().toISOString();

      // Batch update shipments
      const { error: updateError } = await supabase
        .from('envios')
        .update({
          estado: 'recogido' as any,
          estado_retiro: 'retirado',
          fecha_recogida: now,
          chofer_id: user.id,
          updated_at: now,
        })
        .in('id', envioIds);

      if (updateError) {
        console.error('Error confirming collection:', updateError);
        toast.error('Error al confirmar colecta', { description: updateError.message });
        return false;
      }

      // The trigger log_envio_estado_change handles history automatically

      const count = packages.length;
      clearPackages();
      toast.success(`Colecta confirmada: ${count} paquete${count !== 1 ? 's' : ''}`, {
        description: 'Estado actualizado a recogido',
      });
      return true;
    } catch (error: any) {
      console.error('Error confirming collection:', error);
      toast.error('Error al confirmar colecta', { description: error.message });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, packages, clearPackages]);

  return {
    packages,
    isLoading,
    addPackageByTracking,
    removePackage,
    clearPackages,
    confirmCollection,
    hasPackages: packages.length > 0,
  };
}

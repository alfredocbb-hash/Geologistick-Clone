import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Envio = Database['public']['Tables']['envios']['Row'];

export interface FlexPackage {
  id: string;
  tracking_number: string;
  direccion_entrega: string | null;
  ciudad_entrega: string | null;
  nombre_destinatario: string | null;
  entrega_lat: number | null;
  entrega_lng: number | null;
  estado: string | null;
  wasTransferred?: boolean;
  previousDriver?: string;
}

interface UseFlexPackagesReturn {
  packages: FlexPackage[];
  isLoading: boolean;
  addPackage: (envioId: string) => Promise<FlexPackage | null>;
  addPackageByTracking: (tracking: string) => Promise<FlexPackage | null>;
  removePackage: (id: string) => void;
  clearPackages: () => void;
  optimizeRoute: (currentLocation: { lat: number; lng: number }) => void;
  createRoute: () => Promise<string | null>;
  createRouteSheet: (sucursalDestinoId: string) => Promise<string | null>;
  hasPackages: boolean;
  packagesWithCoords: FlexPackage[];
}

const STORAGE_KEY = 'flex-packages';

// Haversine formula for distance calculation
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Nearest-neighbor algorithm for route optimization
function nearestNeighborSort(
  packages: FlexPackage[],
  startLat: number,
  startLng: number
): FlexPackage[] {
  const packagesWithCoords = packages.filter(p => p.entrega_lat && p.entrega_lng);
  const packagesWithoutCoords = packages.filter(p => !p.entrega_lat || !p.entrega_lng);
  
  if (packagesWithCoords.length === 0) return packages;
  
  const sorted: FlexPackage[] = [];
  const remaining = [...packagesWithCoords];
  let currentLat = startLat;
  let currentLng = startLng;
  
  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    
    remaining.forEach((pkg, index) => {
      const distance = calculateDistance(
        currentLat,
        currentLng,
        pkg.entrega_lat!,
        pkg.entrega_lng!
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    
    const nearest = remaining.splice(nearestIndex, 1)[0];
    sorted.push(nearest);
    currentLat = nearest.entrega_lat!;
    currentLng = nearest.entrega_lng!;
  }
  
  // Add packages without coordinates at the end
  return [...sorted, ...packagesWithoutCoords];
}

// Generate a unique route number
function generateRouteNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `FLX-${dateStr}-${random}`;
}

export function useFlexPackages(): UseFlexPackagesReturn {
  const { user, profile } = useAuth();
  const [packages, setPackages] = useState<FlexPackage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setPackages(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading flex packages from storage:', e);
      }
    }
  }, []);

  // Save to sessionStorage whenever packages change
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(packages));
  }, [packages]);

  // Check and handle automatic transfer if package is assigned to another driver
  const handleAutoTransfer = useCallback(async (envio: Envio): Promise<{ wasTransferred: boolean; previousDriver?: string }> => {
    if (!user?.id) return { wasTransferred: false };
    
    // If already assigned to current user, no transfer needed
    if (!envio.chofer_id || envio.chofer_id === user.id) {
      // Assign to current user if not assigned
      if (!envio.chofer_id) {
        await supabase.from('envios').update({
          chofer_id: user.id,
          chofer_ultima_milla_id: user.id,
          fecha_asignacion_ultima_milla: new Date().toISOString(),
        }).eq('id', envio.id);
      }
      return { wasTransferred: false };
    }
    
    // Get previous driver's name for the toast
    const { data: prevProfile } = await supabase
      .from('profiles')
      .select('nombre, apellido')
      .eq('user_id', envio.chofer_id)
      .single();
    
    const previousDriverName = prevProfile 
      ? `${prevProfile.nombre} ${prevProfile.apellido || ''}`.trim() 
      : 'otro chofer';
    
    // Automatic transfer
    const { error: updateError } = await supabase.from('envios').update({
      chofer_id: user.id,
      chofer_ultima_milla_id: user.id,
      fecha_asignacion_ultima_milla: new Date().toISOString(),
    }).eq('id', envio.id);

    if (updateError) {
      console.error('Error transferring package:', updateError);
      throw new Error('Error al transferir el paquete');
    }

    // Log in history
    await supabase.from('envio_historial').insert({
      envio_id: envio.id,
      estado_anterior: envio.estado,
      estado_nuevo: envio.estado,
      notas: `Transferido automáticamente de ${previousDriverName} (Modo Flex)`,
      created_by: user.id,
    });

    return { wasTransferred: true, previousDriver: previousDriverName };
  }, [user?.id]);

  // Auto-geocode packages missing coordinates
  const geocodePackage = useCallback(async (pkg: FlexPackage): Promise<FlexPackage> => {
    if ((pkg.entrega_lat && pkg.entrega_lng) || !pkg.direccion_entrega) return pkg;

    try {
      const { data, error } = await supabase.functions.invoke('geocode-address', {
        body: {
          address: pkg.direccion_entrega,
          city: pkg.ciudad_entrega || undefined,
        }
      });

      if (error || !data?.lat || !data?.lng) return pkg;

      // Update coordinates in DB
      await supabase.from('envios').update({
        entrega_lat: data.lat,
        entrega_lng: data.lng,
      }).eq('id', pkg.id);

      return { ...pkg, entrega_lat: data.lat, entrega_lng: data.lng };
    } catch (e) {
      console.error('Error geocoding package:', e);
      return pkg;
    }
  }, []);

  // Add package by ID
  const addPackage = useCallback(async (envioId: string): Promise<FlexPackage | null> => {
    if (!user?.id) return null;
    
    // Check if already added
    if (packages.some(p => p.id === envioId)) {
      toast.info('Este paquete ya está en la lista');
      return null;
    }

    setIsLoading(true);
    try {
      const { data: envio, error } = await supabase
        .from('envios')
        .select('*')
        .eq('id', envioId)
        .single();

      if (error || !envio) {
        toast.error('Paquete no encontrado');
        return null;
      }

      // Handle automatic transfer
      const { wasTransferred, previousDriver } = await handleAutoTransfer(envio);

      const flexPackage: FlexPackage = {
        id: envio.id,
        tracking_number: envio.tracking_number,
        direccion_entrega: envio.direccion_entrega,
        ciudad_entrega: envio.ciudad_entrega,
        nombre_destinatario: envio.nombre_destinatario,
        entrega_lat: envio.entrega_lat,
        entrega_lng: envio.entrega_lng,
        estado: envio.estado,
        wasTransferred,
        previousDriver,
      };

      setPackages(prev => [...prev, flexPackage]);

      // Auto-geocode if missing coordinates (fire and forget)
      if (!flexPackage.entrega_lat && !flexPackage.entrega_lng && flexPackage.direccion_entrega) {
        geocodePackage(flexPackage).then(geocoded => {
          if (geocoded.entrega_lat && geocoded.entrega_lng) {
            setPackages(prev => prev.map(p => p.id === geocoded.id ? geocoded : p));
          }
        });
      }

      if (wasTransferred) {
        toast.success(`Paquete transferido de ${previousDriver}`, {
          description: envio.tracking_number,
        });
      } else {
        toast.success('Paquete agregado', {
          description: envio.tracking_number,
        });
      }

      return flexPackage;
    } catch (error: any) {
      console.error('Error adding package:', error);
      toast.error('Error al agregar paquete', { description: error.message });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, packages, handleAutoTransfer, geocodePackage]);

  // Add package by tracking number
  const addPackageByTracking = useCallback(async (tracking: string): Promise<FlexPackage | null> => {
    if (!user?.id) return null;

    // Check if already added
    if (packages.some(p => p.tracking_number === tracking)) {
      toast.info('Este paquete ya está en la lista');
      return null;
    }

    setIsLoading(true);
    try {
      const tenantId = (profile as any)?.tenant_id;
      
      // Primary search: case-insensitive exact match
      const { data: envio } = await supabase
        .from('envios')
        .select('*')
        .ilike('tracking_number', tracking)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (envio) {
        return await addPackage(envio.id);
      }

      // Fallback: try removing any remaining suffix and search with wildcard
      const baseTracking = tracking.replace(/-\d{1,2}$/, '');
      if (baseTracking !== tracking) {
        const { data: envioFallback } = await supabase
          .from('envios')
          .select('*')
          .ilike('tracking_number', baseTracking)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (envioFallback) {
          return await addPackage(envioFallback.id);
        }
      }

      return null; // Return null so caller can handle ML registration
    } catch (error: any) {
      console.error('Error adding package by tracking:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, profile, packages, addPackage]);

  // Remove package
  const removePackage = useCallback((id: string) => {
    setPackages(prev => prev.filter(p => p.id !== id));
    toast.info('Paquete removido de la lista');
  }, []);

  // Clear all packages
  const clearPackages = useCallback(() => {
    setPackages([]);
    sessionStorage.removeItem(STORAGE_KEY);
    toast.info('Lista limpiada');
  }, []);

  // Optimize route based on current location
  const optimizeRoute = useCallback((currentLocation: { lat: number; lng: number }) => {
    if (packages.length < 2) {
      toast.info('Se necesitan al menos 2 paquetes para optimizar');
      return;
    }

    const optimized = nearestNeighborSort(packages, currentLocation.lat, currentLocation.lng);
    setPackages(optimized);
    toast.success('Ruta optimizada', {
      description: 'Paradas ordenadas por proximidad',
    });
  }, [packages]);

  // Create planned route
  const createRoute = useCallback(async (): Promise<string | null> => {
    if (!user?.id || !(profile as any)?.tenant_id || packages.length === 0) {
      toast.error('No hay paquetes para iniciar el reparto');
      return null;
    }

    setIsLoading(true);
    try {
      // Create the planned route
      const { data: ruta, error: rutaError } = await supabase
        .from('rutas_planificadas')
        .insert({
          chofer_id: user.id,
          tenant_id: (profile as any).tenant_id,
          numero: generateRouteNumber(),
          estado: 'pendiente',
          fecha: new Date().toISOString().split('T')[0],
          total_paradas: packages.length,
        })
        .select()
        .single();

      if (rutaError || !ruta) {
        console.error('Error creating route:', rutaError);
        throw new Error(rutaError?.message || 'Error al crear la ruta');
      }

      // Add shipments to the route
      const paradas = packages.map((pkg, index) => ({
        ruta_id: ruta.id,
        envio_id: pkg.id,
        orden: index + 1,
        estado: 'pendiente',
        tipo: 'entrega',
        direccion: pkg.direccion_entrega,
        lat: pkg.entrega_lat,
        lng: pkg.entrega_lng,
      }));

      const { error: paradasError } = await supabase
        .from('ruta_paradas')
        .insert(paradas);

      if (paradasError) {
        throw new Error('Error al agregar paradas');
      }

      // Start the route immediately (changes status to 'en_curso' and shipments to 'en_reparto')
      const { data: startResult, error: startError } = await supabase.rpc(
        'start_ruta_planificada',
        { p_ruta_id: ruta.id }
      );

      if (startError) {
        console.error('Error starting route:', startError);
        // Don't block - route is already created, just continue
      } else {
        const result = startResult as { success?: boolean; error?: string } | null;
        if (result && !result.success) {
          console.error('Route start returned error:', result.error);
        }
      }

      // Clear the flex packages list
      clearPackages();

      toast.success('Ruta iniciada', {
        description: `${packages.length} paradas en reparto`,
      });

      return ruta.id;
    } catch (error: any) {
      console.error('Error creating route:', error);
      toast.error('Error al crear ruta', { description: error.message });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, profile, packages, clearPackages]);

  // Create route sheet (hoja de ruta) for inter-branch transport
  const createRouteSheet = useCallback(async (sucursalDestinoId: string): Promise<string | null> => {
    if (!user?.id || packages.length === 0) {
      toast.error('No hay paquetes para la hoja de ruta');
      return null;
    }

    setIsLoading(true);
    try {
      const envioIds = packages.map(p => p.id);
      const { data, error } = await supabase.rpc('create_hoja_ruta_flex', {
        p_sucursal_destino_id: sucursalDestinoId,
        p_envio_ids: envioIds,
      });

      if (error) throw error;

      const result = data as { success?: boolean; error?: string; hoja_id?: string; numero?: string } | null;

      if (!result?.success) {
        throw new Error(result?.error || 'Error al crear hoja de ruta');
      }

      clearPackages();
      return result.hoja_id!;
    } catch (error: any) {
      console.error('Error creating route sheet:', error);
      toast.error('Error al crear hoja de ruta', { description: error.message });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, packages, clearPackages]);

  const packagesWithCoords = packages.filter(p => p.entrega_lat && p.entrega_lng);

  return {
    packages,
    isLoading,
    addPackage,
    addPackageByTracking,
    removePackage,
    clearPackages,
    optimizeRoute,
    createRoute,
    createRouteSheet,
    hasPackages: packages.length > 0,
    packagesWithCoords,
  };
}

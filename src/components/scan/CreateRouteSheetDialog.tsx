import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Building2, Package, Loader2, MapPin, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateRouteSheetDialogProps {
  open: boolean;
  packagesCount: number;
  packageIds: string[];
  onClose: () => void;
  onSuccess: (hojaId: string) => void;
}

export function CreateRouteSheetDialog({
  open,
  packagesCount,
  packageIds,
  onClose,
  onSuccess,
}: CreateRouteSheetDialogProps) {
  const { profile } = useAuth();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const tenantId = (profile as any)?.tenant_id;
  const userBranchId = (profile as any)?.sucursal_id;

  // Fetch branches (excluding user's own branch)
  const { data: branches = [], isLoading: loadingBranches } = useQuery({
    queryKey: ['sucursales-for-route-sheet', tenantId, userBranchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursales')
        .select('id, nombre, codigo, direccion, ciudad')
        .eq('tenant_id', tenantId)
        .eq('activa', true)
        .neq('id', userBranchId)
        .order('nombre');

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!tenantId && !!userBranchId,
  });

  const handleCreate = async () => {
    if (!selectedBranchId || packageIds.length === 0) return;

    setIsCreating(true);
    try {
      const { data, error } = await supabase.rpc('create_hoja_ruta_flex', {
        p_sucursal_destino_id: selectedBranchId,
        p_envio_ids: packageIds,
      });

      if (error) throw error;

      const result = data as { success?: boolean; error?: string; hoja_id?: string; numero?: string; envios_count?: number } | null;

      if (!result?.success) {
        throw new Error(result?.error || 'Error al crear hoja de ruta');
      }

      toast.success('Hoja de ruta creada', {
        description: `${result.numero} - ${result.envios_count} envíos en tránsito`,
      });

      onSuccess(result.hoja_id!);
    } catch (error: any) {
      console.error('Error creating route sheet:', error);
      toast.error('Error al crear hoja de ruta', { description: error.message });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md bg-slate-950 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-400" />
            Crear Hoja de Ruta
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Seleccioná la sucursal destino para transportar los paquetes.
          </DialogDescription>
        </DialogHeader>

        {/* Packages summary */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-900/50 border border-slate-800">
          <Package className="h-4 w-4 text-primary" />
          <span className="text-sm text-slate-300">
            {packagesCount} paquete{packagesCount !== 1 ? 's' : ''} escaneado{packagesCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Branch selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Sucursal destino</label>
          {loadingBranches ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            </div>
          ) : branches.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-500">
              No hay otras sucursales disponibles
            </div>
          ) : (
            <ScrollArea className="max-h-[250px]">
              <div className="space-y-2 pr-2">
                {branches.map((branch) => (
                  <button
                    key={branch.id}
                    onClick={() => setSelectedBranchId(branch.id)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border transition-all',
                      selectedBranchId === branch.id
                        ? 'border-blue-500 bg-blue-950/30'
                        : 'border-slate-800 bg-slate-900/30 hover:border-slate-700'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-white truncate">
                            {branch.nombre}
                          </span>
                          {branch.codigo && (
                            <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">
                              {branch.codigo}
                            </Badge>
                          )}
                        </div>
                        {(branch.direccion || branch.ciudad) && (
                          <div className="flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3 text-slate-500 flex-shrink-0" />
                            <span className="text-xs text-slate-500 truncate">
                              {[branch.direccion, branch.ciudad].filter(Boolean).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                      {selectedBranchId === branch.id && (
                        <Check className="h-4 w-4 text-blue-400 flex-shrink-0 ml-2" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isCreating}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!selectedBranchId || isCreating}
            className="bg-blue-600 hover:bg-blue-500 text-white"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creando...
              </>
            ) : (
              'Crear Hoja de Ruta'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

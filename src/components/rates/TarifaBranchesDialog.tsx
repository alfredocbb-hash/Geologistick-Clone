import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface TarifaBranchesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarifaId: string;
  tarifaNombre: string;
}

interface Sucursal {
  id: string;
  nombre: string;
  codigo: string | null;
  ciudad: string | null;
}

interface SucursalTarifa {
  id: string;
  sucursal_id: string;
  tarifa_id: string;
  habilitada: boolean;
}

export function TarifaBranchesDialog({
  open,
  onOpenChange,
  tarifaId,
  tarifaNombre,
}: TarifaBranchesDialogProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(new Set());

  // Fetch sucursales
  const { data: sucursales = [], isLoading: loadingSucursales } = useQuery({
    queryKey: ['sucursales-for-tarifas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursales')
        .select('id, nombre, codigo, ciudad')
        .eq('activa', true)
        .order('nombre');
      if (error) throw error;
      return data as Sucursal[];
    },
    enabled: open,
  });

  // Fetch current tarifa-branch assignments
  const { data: sucursalTarifas = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ['sucursal-tarifas', tarifaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursal_tarifas')
        .select('*')
        .eq('tarifa_id', tarifaId);
      if (error) throw error;
      return data as SucursalTarifa[];
    },
    enabled: open && !!tarifaId,
  });

  // Initialize selected branches when data loads
  useEffect(() => {
    if (sucursalTarifas.length > 0) {
      const enabled = new Set(
        sucursalTarifas
          .filter(st => st.habilitada)
          .map(st => st.sucursal_id)
      );
      setSelectedBranches(enabled);
    } else {
      setSelectedBranches(new Set());
    }
  }, [sucursalTarifas]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // For each sucursal, upsert the assignment
      const upsertRows = sucursales
        .filter(s => selectedBranches.has(s.id) || sucursalTarifas.some(st => st.sucursal_id === s.id))
        .map(s => ({
          sucursal_id: s.id,
          tarifa_id: tarifaId,
          habilitada: selectedBranches.has(s.id),
          tenant_id: profile?.tenant_id,
          updated_at: new Date().toISOString(),
        }));

      if (upsertRows.length > 0) {
        const { error } = await supabase
          .from('sucursal_tarifas')
          .upsert(upsertRows, { onConflict: 'sucursal_id,tarifa_id' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sucursal-tarifas'] });
      toast.success('Sucursales actualizadas');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  const toggleBranch = (branchId: string) => {
    setSelectedBranches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(branchId)) {
        newSet.delete(branchId);
      } else {
        newSet.add(branchId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedBranches(new Set(sucursales.map(s => s.id)));
  };

  const deselectAll = () => {
    setSelectedBranches(new Set());
  };

  const isLoading = loadingSucursales || loadingAssignments;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Sucursales - {tarifaNombre}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selecciona las sucursales que pueden usar esta tarifa.
          </p>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Todas
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  Ninguna
                </Button>
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-2 border rounded-lg p-3">
                {sucursales.map((sucursal) => (
                  <div
                    key={sucursal.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`branch-tarifa-${sucursal.id}`}
                      checked={selectedBranches.has(sucursal.id)}
                      onCheckedChange={() => toggleBranch(sucursal.id)}
                    />
                    <Label
                      htmlFor={`branch-tarifa-${sucursal.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <span className="font-medium">{sucursal.nombre}</span>
                      {(sucursal.codigo || sucursal.ciudad) && (
                        <span className="text-muted-foreground text-sm ml-2">
                          {sucursal.codigo && `(${sucursal.codigo})`}
                          {sucursal.ciudad && ` - ${sucursal.ciudad}`}
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>

              <div className="text-sm text-muted-foreground">
                {selectedBranches.size} de {sucursales.length} sucursales seleccionadas
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="bg-tarifas hover:bg-tarifas/90"
            >
              {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

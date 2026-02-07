import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Trash2, MapPin, Copy, Loader2, Globe, Map, List } from 'lucide-react';
import { CoverageMapSelector } from './CoverageMapSelector';
import { CoverageZonesListForm } from './CoverageZonesListForm';

interface BranchCoverageZonesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sucursalId: string;
  sucursalNombre: string;
  sucursalLat?: number | null;
  sucursalLng?: number | null;
  allSucursales: { id: string; nombre: string; codigo: string | null }[];
}

interface CoverageZone {
  id: string;
  sucursal_id: string;
  ciudad: string | null;
  provincia: string | null;
  codigo_postal_desde: string | null;
  codigo_postal_hasta: string | null;
  activa: boolean | null;
  created_at: string | null;
  lat: number | null;
  lng: number | null;
}

export function BranchCoverageZonesDialog({
  open,
  onOpenChange,
  sucursalId,
  sucursalNombre,
  sucursalLat,
  sucursalLng,
  allSucursales,
}: BranchCoverageZonesDialogProps) {
  const queryClient = useQueryClient();
  const [copySucursalId, setCopySucursalId] = useState('');

  // Fetch zones for this branch
  const { data: zones = [], isLoading } = useQuery({
    queryKey: ['sucursal-zonas', sucursalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursal_zonas')
        .select('*')
        .eq('sucursal_id', sucursalId)
        .order('provincia')
        .order('ciudad');
      if (error) throw error;
      return data as CoverageZone[];
    },
    enabled: open && !!sucursalId,
  });

  const activeCount = zones.filter(z => z.activa).length;

  // Add zone mutation
  const addZoneMutation = useMutation({
    mutationFn: async (zone: { ciudad: string; provincia: string; codigo_postal_desde: string; codigo_postal_hasta?: string; lat?: number; lng?: number }) => {
      if (!zone.ciudad && !zone.provincia && !zone.codigo_postal_desde) {
        throw new Error('Debe completar al menos un campo: Ciudad, Provincia o Código Postal');
      }
      const { error } = await supabase
        .from('sucursal_zonas')
        .insert({
          sucursal_id: sucursalId,
          ciudad: zone.ciudad || null,
          provincia: zone.provincia || null,
          codigo_postal_desde: zone.codigo_postal_desde || null,
          codigo_postal_hasta: zone.codigo_postal_hasta || null,
          lat: zone.lat ?? null,
          lng: zone.lng ?? null,
          activa: true,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sucursal-zonas', sucursalId] });
      toast.success('Zona de cobertura agregada');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Toggle zone active
  const toggleZoneMutation = useMutation({
    mutationFn: async ({ id, activa }: { id: string; activa: boolean }) => {
      const { error } = await supabase
        .from('sucursal_zonas')
        .update({ activa })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sucursal-zonas', sucursalId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Delete zone mutation
  const deleteZoneMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sucursal_zonas')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sucursal-zonas', sucursalId] });
      toast.success('Zona eliminada');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Copy zones from another branch
  const copyZonesMutation = useMutation({
    mutationFn: async (fromSucursalId: string) => {
      const { data: sourceZones, error: fetchError } = await supabase
        .from('sucursal_zonas')
        .select('ciudad, provincia, codigo_postal_desde, codigo_postal_hasta, lat, lng')
        .eq('sucursal_id', fromSucursalId);
      if (fetchError) throw fetchError;
      if (!sourceZones || sourceZones.length === 0) {
        throw new Error('La sucursal seleccionada no tiene zonas configuradas');
      }

      const newZones = sourceZones.map(z => ({
        sucursal_id: sucursalId,
        ciudad: z.ciudad,
        provincia: z.provincia,
        codigo_postal_desde: z.codigo_postal_desde,
        codigo_postal_hasta: z.codigo_postal_hasta,
        lat: z.lat,
        lng: z.lng,
        activa: true,
      }));

      const { error: insertError } = await supabase
        .from('sucursal_zonas')
        .insert(newZones as any);
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sucursal-zonas', sucursalId] });
      setCopySucursalId('');
      toast.success('Zonas copiadas correctamente');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleAddZoneFromList = (zone: { ciudad: string; provincia: string; codigo_postal_desde: string; codigo_postal_hasta: string }) => {
    addZoneMutation.mutate(zone);
  };

  const handleAddZoneFromMap = (zone: { ciudad: string; provincia: string; codigo_postal_desde: string; lat: number; lng: number }) => {
    addZoneMutation.mutate(zone);
  };

  const otherBranches = allSucursales.filter(s => s.id !== sucursalId);

  const formatZoneDescription = (zone: CoverageZone) => {
    const parts: string[] = [];
    if (zone.ciudad) parts.push(zone.ciudad);
    if (zone.provincia) parts.push(zone.provincia);
    if (zone.codigo_postal_desde && zone.codigo_postal_hasta) {
      parts.push(`CP ${zone.codigo_postal_desde}-${zone.codigo_postal_hasta}`);
    } else if (zone.codigo_postal_desde) {
      parts.push(`CP ${zone.codigo_postal_desde}`);
    }
    return parts.join(', ') || 'Sin datos';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Zonas de Cobertura — {sucursalNombre}
          </DialogTitle>
        </DialogHeader>

        {/* Stats */}
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1">
            <MapPin className="h-3 w-3" />
            {zones.length} zona{zones.length !== 1 ? 's' : ''}
          </Badge>
          <Badge className="bg-success/10 text-success gap-1">
            {activeCount} activa{activeCount !== 1 ? 's' : ''}
          </Badge>
          {zones.length === 0 && (
            <span className="text-xs text-muted-foreground">
              Sin restricción — acepta envíos a cualquier destino
            </span>
          )}
        </div>

        <Separator />

        {/* Tabs: Map / List */}
        <Tabs defaultValue="mapa" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="mapa" className="gap-1.5">
              <Map className="h-4 w-4" />
              Mapa
            </TabsTrigger>
            <TabsTrigger value="lista" className="gap-1.5">
              <List className="h-4 w-4" />
              Lista
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mapa">
            <CoverageMapSelector
              branchLat={sucursalLat ?? null}
              branchLng={sucursalLng ?? null}
              zones={zones}
              onAddZone={handleAddZoneFromMap}
              onDeleteZone={(id) => deleteZoneMutation.mutate(id)}
              isAdding={addZoneMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="lista">
            <CoverageZonesListForm
              onAddZone={handleAddZoneFromList}
              isAdding={addZoneMutation.isPending}
            />
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Copy from another branch */}
        {otherBranches.length > 0 && (
          <div className="flex items-center gap-2">
            <Copy className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={copySucursalId} onValueChange={setCopySucursalId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Copiar zonas de otra sucursal..." />
              </SelectTrigger>
              <SelectContent>
                {otherBranches.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.codigo ? `${s.codigo} - ` : ''}{s.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              disabled={!copySucursalId || copyZonesMutation.isPending}
              onClick={() => copySucursalId && copyZonesMutation.mutate(copySucursalId)}
            >
              {copyZonesMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Copiar'
              )}
            </Button>
          </div>
        )}

        {/* Zones table */}
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Cargando zonas...</div>
        ) : zones.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Globe className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="font-medium">Sin zonas configuradas</p>
            <p className="text-xs mt-1">
              Esta sucursal acepta envíos a cualquier destino. Agrega zonas para limitar la cobertura.
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zona</TableHead>
                  <TableHead className="w-[80px] text-center">Activa</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map(zone => (
                  <TableRow key={zone.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {formatZoneDescription(zone)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {zone.ciudad && zone.provincia ? 'Ciudad + Provincia' :
                           zone.ciudad ? 'Ciudad' :
                           zone.provincia ? 'Provincia' :
                           zone.codigo_postal_desde ? 'Código Postal' : ''}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={zone.activa ?? true}
                        onCheckedChange={(checked) =>
                          toggleZoneMutation.mutate({ id: zone.id, activa: checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteZoneMutation.mutate(zone.id)}
                        disabled={deleteZoneMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

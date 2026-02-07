import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Loader2 } from 'lucide-react';

interface CoverageZonesListFormProps {
  onAddZone: (zone: { ciudad: string; provincia: string; codigo_postal_desde: string; codigo_postal_hasta: string }) => void;
  isAdding: boolean;
}

export function CoverageZonesListForm({ onAddZone, isAdding }: CoverageZonesListFormProps) {
  const [newZone, setNewZone] = useState({
    ciudad: '',
    provincia: '',
    codigo_postal_desde: '',
    codigo_postal_hasta: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddZone(newZone);
    setNewZone({ ciudad: '', provincia: '', codigo_postal_desde: '', codigo_postal_hasta: '' });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Label className="font-semibold text-sm">Agregar nueva zona</Label>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Ciudad</Label>
          <Input
            placeholder="Ej: Córdoba"
            value={newZone.ciudad}
            onChange={e => setNewZone(prev => ({ ...prev, ciudad: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Provincia</Label>
          <Input
            placeholder="Ej: Buenos Aires"
            value={newZone.provincia}
            onChange={e => setNewZone(prev => ({ ...prev, provincia: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">CP Desde</Label>
          <Input
            placeholder="Ej: 1000"
            value={newZone.codigo_postal_desde}
            onChange={e => setNewZone(prev => ({ ...prev, codigo_postal_desde: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">CP Hasta</Label>
          <Input
            placeholder="Ej: 1499"
            value={newZone.codigo_postal_hasta}
            onChange={e => setNewZone(prev => ({ ...prev, codigo_postal_hasta: e.target.value }))}
          />
        </div>
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={isAdding}
        className="w-full"
      >
        {isAdding ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Plus className="h-4 w-4 mr-2" />
        )}
        Agregar Zona
      </Button>
    </form>
  );
}

import { useState } from 'react';
import { usePartners } from '@/hooks/usePartners';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Handshake } from 'lucide-react';

interface DeriveShipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  envioId: string;
  trackingNumber: string;
}

export function DeriveShipmentDialog({ open, onOpenChange, envioId, trackingNumber }: DeriveShipmentDialogProps) {
  const { activePartnerships, deriveShipment } = usePartners();
  const [selectedPartnership, setSelectedPartnership] = useState<string>('');

  const selected = activePartnerships.find(p => p.id === selectedPartnership);

  const handleDerive = async () => {
    if (!selected) return;
    await deriveShipment.mutateAsync({
      partnershipId: selected.id,
      envioId,
      targetTenantId: selected.partner_tenant_id,
    });
    onOpenChange(false);
    setSelectedPartnership('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5" />
            Derivar Envío a Partner
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Envío: <span className="font-mono text-foreground">{trackingNumber}</span>
          </p>

          {activePartnerships.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tienes partnerships activas. Crea una desde Empresas Asociadas.</p>
          ) : (
            <div className="space-y-2">
              <Label>Seleccionar Partner</Label>
              <Select value={selectedPartnership} onValueChange={setSelectedPartnership}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegir empresa..." />
                </SelectTrigger>
                <SelectContent>
                  {activePartnerships.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.partner_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleDerive}
            disabled={!selectedPartnership || deriveShipment.isPending}
          >
            {deriveShipment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Derivar Envío
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

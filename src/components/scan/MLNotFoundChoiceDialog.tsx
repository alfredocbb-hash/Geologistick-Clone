import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Camera, Truck } from 'lucide-react';

interface MLNotFoundChoiceDialogProps {
  open: boolean;
  mlShipmentId: string;
  onClose: () => void;
  onChooseManual: () => void;
  onChooseOCR: () => void;
}

export function MLNotFoundChoiceDialog({
  open,
  mlShipmentId,
  onClose,
  onChooseManual,
  onChooseOCR,
}: MLNotFoundChoiceDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-amber-500" />
            Envío ML no encontrado
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                El envío de MercadoLibre no está registrado en el sistema. ¿Cómo desea registrarlo?
              </p>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Shipment ID:</span>
                <Badge variant="secondary" className="font-mono text-base">
                  {mlShipmentId}
                </Badge>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-3 pt-2">
          <Button
            onClick={onChooseManual}
            variant="outline"
            className="w-full h-14 gap-3 justify-start text-left"
          >
            <Truck className="h-5 w-5 text-blue-500 flex-shrink-0" />
            <div>
              <div className="font-semibold">Registrar con datos ML</div>
              <div className="text-xs text-muted-foreground font-normal">
                Obtener datos desde la API de MercadoLibre
              </div>
            </div>
          </Button>

          <Button
            onClick={onChooseOCR}
            variant="outline"
            className="w-full h-14 gap-3 justify-start text-left"
          >
            <Camera className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <div>
              <div className="font-semibold">Escanear etiqueta (OCR)</div>
              <div className="text-xs text-muted-foreground font-normal">
                Tomar foto de la etiqueta para extraer datos
              </div>
            </div>
          </Button>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

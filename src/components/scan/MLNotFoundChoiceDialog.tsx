import { useState } from 'react';
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
import { Package, Camera, Truck, Image, ArrowLeft } from 'lucide-react';

interface MLNotFoundChoiceDialogProps {
  open: boolean;
  mlShipmentId: string;
  onClose: () => void;
  onChooseManual: () => void;
  onChooseOCR: () => void;
  onChooseBulkOCR?: () => void;
}

export function MLNotFoundChoiceDialog({
  open,
  mlShipmentId,
  onClose,
  onChooseManual,
  onChooseOCR,
  onChooseBulkOCR,
}: MLNotFoundChoiceDialogProps) {
  const [step, setStep] = useState<'choice' | 'ocr-mode'>('choice');

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setStep('choice');
      onClose();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {step === 'ocr-mode' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 -ml-1"
                onClick={() => setStep('choice')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Package className="h-5 w-5 text-amber-500" />
            {step === 'choice' ? 'Envío ML no encontrado' : 'Modo de escaneo OCR'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                {step === 'choice'
                  ? 'El envío de MercadoLibre no está registrado en el sistema. ¿Cómo desea registrarlo?'
                  : '¿Cuántas etiquetas necesita escanear?'}
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

        {step === 'choice' && (
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
              onClick={() => {
                if (onChooseBulkOCR) {
                  setStep('ocr-mode');
                } else {
                  onChooseOCR();
                }
              }}
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
        )}

        {step === 'ocr-mode' && (
          <div className="flex flex-col gap-3 pt-2">
            <Button
              onClick={() => {
                setStep('choice');
                onChooseOCR();
              }}
              variant="outline"
              className="w-full h-14 gap-3 justify-start text-left"
            >
              <Camera className="h-5 w-5 text-blue-500 flex-shrink-0" />
              <div>
                <div className="font-semibold">Una etiqueta</div>
                <div className="text-xs text-muted-foreground font-normal">
                  Escanear una sola etiqueta ahora
                </div>
              </div>
            </Button>

            <Button
              onClick={() => {
                setStep('choice');
                onChooseBulkOCR?.();
              }}
              variant="outline"
              className="w-full h-14 gap-3 justify-start text-left"
            >
              <Image className="h-5 w-5 text-emerald-500 flex-shrink-0" />
              <div>
                <div className="font-semibold">Modo masivo (álbum)</div>
                <div className="text-xs text-muted-foreground font-normal">
                  Tomar varias fotos y procesar todas juntas
                </div>
              </div>
            </Button>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setStep('choice')}>Cancelar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

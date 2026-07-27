import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  sendSettlementViaWhatsApp,
  type SettlementTipo,
} from '@/lib/sendSettlementWhatsApp';

interface Props {
  phone?: string | null;
  nombre?: string | null;
  tipo: SettlementTipo;
  periodoInicio?: string | null;
  periodoFin?: string | null;
  monto: number | null | undefined;
  onDownloadPdf?: () => void | Promise<void>;
  size?: 'sm' | 'default' | 'lg' | 'icon';
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  iconOnly?: boolean;
  className?: string;
}

export function SendWhatsAppButton({
  phone,
  nombre,
  tipo,
  periodoInicio,
  periodoFin,
  monto,
  onDownloadPdf,
  size = 'sm',
  variant = 'outline',
  iconOnly = false,
  className,
}: Props) {
  const hasPhone = !!(phone && String(phone).trim());

  const handleClick = async () => {
    const ok = await sendSettlementViaWhatsApp({
      phone,
      nombre,
      tipo,
      periodoInicio,
      periodoFin,
      monto,
      onDownloadPdf,
    });
    if (!ok) {
      toast.error('Sin teléfono válido para enviar por WhatsApp');
      return;
    }
    toast.success('Se abrió WhatsApp. Adjuntá el PDF descargado.');
  };

  const btn = (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={!hasPhone}
      className={className}
      title={hasPhone ? 'Enviar por WhatsApp' : 'Sin teléfono cargado'}
    >
      <MessageCircle className={iconOnly ? 'h-4 w-4' : 'mr-2 h-4 w-4 text-green-600'} />
      {!iconOnly && 'WhatsApp'}
    </Button>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{btn}</span>
        </TooltipTrigger>
        <TooltipContent>
          {hasPhone
            ? 'Abre WhatsApp con el resumen. El PDF se descarga para adjuntar manualmente.'
            : 'Sin teléfono cargado para el destinatario'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

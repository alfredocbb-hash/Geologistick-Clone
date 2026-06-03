import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PlanLimitExceededDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: 'sucursal' | 'usuario';
  planName: string;
  current: number;
  max: number;
}

export function PlanLimitExceededDialog({
  open,
  onOpenChange,
  resourceType,
  planName,
  current,
  max,
}: PlanLimitExceededDialogProps) {
  const navigate = useNavigate();
  const label = resourceType === 'sucursal' ? 'la sucursal' : 'el usuario';
  const plural = resourceType === 'sucursal' ? 'sucursales' : 'usuarios';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>Límite del plan excedido</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2 space-y-2">
            <p>
              No se puede reactivar {label} porque excede el plan contratado
              {planName ? ` (${planName})` : ''}.
            </p>
            <p className="font-medium">
              Límite de {plural}: {max} · Actualmente activos: {current}
            </p>
            <p>
              Para ampliar tu plan, comunicate con soporte.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Entendido</AlertDialogCancel>
          <AlertDialogAction onClick={() => navigate('/support')}>
            Contactar soporte
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

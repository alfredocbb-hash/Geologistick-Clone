import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { RotateCcw, X, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface DraftIndicatorProps {
  lastSaved: Date | null;
  onDiscard: () => void;
  onDismiss: () => void;
  className?: string;
}

export function DraftIndicator({ 
  lastSaved, 
  onDiscard, 
  onDismiss,
  className 
}: DraftIndicatorProps) {
  if (!lastSaved) return null;

  const formattedDate = format(lastSaved, "dd/MM 'a las' HH:mm", { locale: es });

  return (
    <Alert className={`border-primary/30 bg-primary/5 ${className}`}>
      <RotateCcw className="h-4 w-4 text-primary" />
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span>
            Borrador recuperado del <strong>{formattedDate}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-7 text-xs"
          >
            Continuar editando
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDiscard}
            className="h-7 text-xs text-destructive hover:text-destructive"
          >
            <X className="h-3 w-3 mr-1" />
            Descartar
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

interface DraftSavingIndicatorProps {
  hasDraft: boolean;
  lastSaved: Date | null;
}

export function DraftSavingIndicator({ hasDraft, lastSaved }: DraftSavingIndicatorProps) {
  if (!hasDraft || !lastSaved) return null;

  const formattedTime = format(lastSaved, 'HH:mm:ss');

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
      <span>Guardado {formattedTime}</span>
    </div>
  );
}

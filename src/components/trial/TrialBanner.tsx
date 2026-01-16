import { Link } from "react-router-dom";
import { useTrial } from "@/hooks/useTrial";
import { Clock, AlertTriangle, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function TrialBanner() {
  const { isOnTrial, daysRemaining, isTrialExpired, hasActiveSubscription, isLoading } = useTrial();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if loading, has subscription, or dismissed
  if (isLoading || hasActiveSubscription || dismissed) {
    return null;
  }

  // Show expired banner
  if (isTrialExpired) {
    return (
      <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-medium text-destructive">
                Tu período de prueba ha expirado
              </p>
              <p className="text-xs text-destructive/80">
                Suscríbete para seguir usando todas las funcionalidades
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="destructive">
            <Link to="/subscription">Ver Planes</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Show trial banner
  if (isOnTrial) {
    const isUrgent = daysRemaining <= 3;
    
    return (
      <div className={`border-b px-4 py-3 ${
        isUrgent 
          ? "bg-amber-500/10 border-amber-500/20" 
          : "bg-primary/5 border-primary/10"
      }`}>
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              isUrgent ? "bg-amber-500/20" : "bg-primary/10"
            }`}>
              {isUrgent ? (
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              ) : (
                <Sparkles className="h-4 w-4 text-primary" />
              )}
            </div>
            <div>
              <p className={`text-sm font-medium ${
                isUrgent ? "text-amber-700 dark:text-amber-400" : "text-foreground"
              }`}>
                {isUrgent 
                  ? `¡Solo quedan ${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'} de prueba!`
                  : `Período de prueba: ${daysRemaining} días restantes`
                }
              </p>
              <p className={`text-xs ${
                isUrgent ? "text-amber-600/80 dark:text-amber-500" : "text-muted-foreground"
              }`}>
                {isUrgent 
                  ? "Suscríbete ahora para no perder acceso"
                  : "Explora todas las funcionalidades sin límites"
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              asChild 
              size="sm" 
              variant={isUrgent ? "default" : "outline"}
              className={isUrgent ? "bg-amber-600 hover:bg-amber-700" : ""}
            >
              <Link to="/subscription">Ver Planes</Link>
            </Button>
            {!isUrgent && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setDismissed(true)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
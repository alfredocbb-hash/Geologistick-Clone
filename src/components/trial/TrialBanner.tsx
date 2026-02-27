import { Link } from "react-router-dom";
import { useTrial } from "@/hooks/useTrial";
import { useSubscription } from "@/hooks/useSubscription";
import { Clock, AlertTriangle, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function TrialBanner() {
  const { isOnTrial, daysRemaining: trialDaysRemaining, isTrialExpired, hasActiveSubscription, isLoading: trialLoading } = useTrial();
  const { subscription, daysRemaining: subDaysRemaining, isLoading: subLoading } = useSubscription();
  const [dismissed, setDismissed] = useState(false);

  if (trialLoading || subLoading || dismissed) return null;

  // 1. Paid subscription expiring soon (≤5 days)
  if (subscription?.subscribed && subDaysRemaining !== null && subDaysRemaining <= 5) {
    const isExpired = subDaysRemaining <= 0;

    if (isExpired) {
      return (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3">
          <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium text-destructive">Tu suscripción ha vencido</p>
                <p className="text-xs text-destructive/80">Renueva tu plan para seguir usando todas las funcionalidades</p>
              </div>
            </div>
            <Button asChild size="sm" variant="destructive">
              <Link to="/subscription">Renovar Plan</Link>
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Tu suscripción vence en {subDaysRemaining} {subDaysRemaining === 1 ? "día" : "días"}
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-500">
                Renueva a tiempo para no perder acceso
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="bg-amber-600 hover:bg-amber-700">
              <Link to="/subscription">Renovar</Link>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDismissed(true)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Don't show trial banners if user has active subscription
  if (hasActiveSubscription) return null;

  // 3. Trial expired
  if (isTrialExpired) {
    return (
      <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-medium text-destructive">Tu período de prueba ha expirado</p>
              <p className="text-xs text-destructive/80">Suscríbete para seguir usando todas las funcionalidades</p>
            </div>
          </div>
          <Button asChild size="sm" variant="destructive">
            <Link to="/subscription">Ver Planes</Link>
          </Button>
        </div>
      </div>
    );
  }

  // 4. Active trial
  if (isOnTrial) {
    const isUrgent = trialDaysRemaining <= 3;
    return (
      <div className={`border-b px-4 py-3 ${isUrgent ? "bg-amber-500/10 border-amber-500/20" : "bg-primary/5 border-primary/10"}`}>
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUrgent ? "bg-amber-500/20" : "bg-primary/10"}`}>
              {isUrgent ? <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" /> : <Sparkles className="h-4 w-4 text-primary" />}
            </div>
            <div>
              <p className={`text-sm font-medium ${isUrgent ? "text-amber-700 dark:text-amber-400" : "text-foreground"}`}>
                {isUrgent
                  ? `¡Solo quedan ${trialDaysRemaining} ${trialDaysRemaining === 1 ? "día" : "días"} de prueba!`
                  : `Período de prueba: ${trialDaysRemaining} días restantes`}
              </p>
              <p className={`text-xs ${isUrgent ? "text-amber-600/80 dark:text-amber-500" : "text-muted-foreground"}`}>
                {isUrgent ? "Suscríbete ahora para no perder acceso" : "Explora todas las funcionalidades sin límites"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant={isUrgent ? "default" : "outline"} className={isUrgent ? "bg-amber-600 hover:bg-amber-700" : ""}>
              <Link to="/subscription">Ver Planes</Link>
            </Button>
            {!isUrgent && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDismissed(true)}>
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

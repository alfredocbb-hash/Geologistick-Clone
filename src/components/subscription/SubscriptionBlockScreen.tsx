import { ShieldOff, LogOut, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import type { BlockReason } from "@/hooks/useSubscriptionBlock";

interface SubscriptionBlockScreenProps {
  reason: BlockReason;
}

export function SubscriptionBlockScreen({ reason }: SubscriptionBlockScreenProps) {
  const { signOut } = useAuth();

  const title =
    reason === "trial_expired"
      ? "Tu período de prueba ha finalizado"
      : "Tu suscripción ha vencido";

  const description =
    reason === "trial_expired"
      ? "El período de prueba gratuito ha expirado. Para continuar usando el sistema, contactá al equipo de soporte para activar tu suscripción."
      : "Tu suscripción ha expirado. Para continuar usando el sistema, contactá al equipo de soporte para renovarla.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-md space-y-6">
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <ShieldOff className="h-10 w-10 text-destructive" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground leading-relaxed">{description}</p>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <Button
            asChild
            className="w-full"
          >
            <a href="mailto:soporte@geologistick.com">
              <Mail className="mr-2 h-4 w-4" />
              Contactar Soporte
            </a>
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => signOut()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}

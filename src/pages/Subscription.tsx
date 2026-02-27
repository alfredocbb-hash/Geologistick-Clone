import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Check, Crown, Zap, Building2, Users, Package, CreditCard, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSubscription, SubscriptionPlan } from "@/hooks/useSubscription";
import { useAuth } from "@/lib/auth";
import SuperAdminSubscriptionManager from "@/components/subscriptions/SuperAdminSubscriptionManager";

const planIcons: Record<string, typeof Crown> = {
  "LogiTrack Básico": Zap,
  "LogiTrack Profesional": Building2,
  "LogiTrack Enterprise": Crown,
};

export default function Subscription() {
  const { isSuperAdmin } = useAuth();

  // If super admin, render the management panel
  if (isSuperAdmin()) {
    return <SuperAdminSubscriptionManager />;
  }

  return <TenantSubscriptionView />;
}

function TenantSubscriptionView() {
  const [searchParams] = useSearchParams();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const {
    subscription,
    plans,
    isLoading,
    createCheckoutMP,
    cancelSubscription,
    openCustomerPortal,
    refetchSubscription,
    getUsagePercentage,
  } = useSubscription();

  useEffect(() => {
    if (searchParams.get("success") === "true" || searchParams.get("mp_status") === "approved") {
      toast.success("¡Suscripción activada exitosamente!");
      refetchSubscription();
    } else if (searchParams.get("canceled") === "true") {
      toast.info("Suscripción cancelada");
    }
  }, [searchParams, refetchSubscription]);

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    try {
      // Use Mercado Pago for subscriptions
      await createCheckoutMP(plan.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al crear la suscripción");
    }
  };

  const handleManageSubscription = async () => {
    // For Stripe subscriptions, open customer portal
    if (subscription?.payment_method === "stripe") {
      try {
        await openCustomerPortal();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al abrir el portal");
      }
    } else {
      // For MP subscriptions, show cancel dialog
      setCancelDialogOpen(true);
    }
  };

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    try {
      await cancelSubscription();
      toast.success("Suscripción cancelada correctamente");
      refetchSubscription();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al cancelar la suscripción");
    } finally {
      setIsCancelling(false);
      setCancelDialogOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-8">
        <Skeleton className="h-10 w-64" />
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    );
  }

  const currentPlanName = subscription?.plan_name;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Planes de Suscripción</h1>
          <p className="text-muted-foreground mt-1">
            Elige el plan que mejor se adapte a las necesidades de tu empresa
          </p>
        </div>
        {subscription?.subscribed && (
          <Button variant="outline" onClick={handleManageSubscription}>
            {subscription.payment_method === "stripe" ? (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Gestionar Suscripción
              </>
            ) : (
              <>
                <XCircle className="mr-2 h-4 w-4" />
                Cancelar Suscripción
              </>
            )}
          </Button>
        )}
      </div>

      {/* Current Subscription Summary */}
      {subscription?.subscribed && (
        <Card className="border-primary">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Tu Suscripción Actual
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="default">{subscription.plan_name}</Badge>
                {subscription.payment_method && (
                  <Badge variant="outline" className="capitalize">
                    {subscription.payment_method === "mercadopago" ? "Mercado Pago" : "Stripe"}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" /> Usuarios
                  </span>
                  <span className="font-medium">
                    {subscription.usage?.users_count || 0} / {subscription.limits?.max_users === -1 ? "∞" : subscription.limits?.max_users}
                  </span>
                </div>
                <Progress value={getUsagePercentage("users")} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Sucursales
                  </span>
                  <span className="font-medium">
                    {subscription.usage?.branches_count || 0} / {subscription.limits?.max_branches === -1 ? "∞" : subscription.limits?.max_branches}
                  </span>
                </div>
                <Progress value={getUsagePercentage("branches")} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Package className="h-4 w-4" /> Envíos este mes
                  </span>
                  <span className="font-medium">
                    {subscription.usage?.shipments_count || 0} / {subscription.limits?.max_shipments_month === -1 ? "∞" : subscription.limits?.max_shipments_month}
                  </span>
                </div>
                <Progress value={getUsagePercentage("shipments")} className="h-2" />
              </div>
            </div>
            {subscription.subscription_end && (
              <p className="text-sm text-muted-foreground">
                {subscription.cancel_at_period_end
                  ? `Tu suscripción se cancelará el ${new Date(subscription.subscription_end).toLocaleDateString()}`
                  : `Próxima renovación: ${new Date(subscription.subscription_end).toLocaleDateString()}`}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plans Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans?.map((plan) => {
          const Icon = planIcons[plan.name] || Zap;
          const isCurrentPlan = plan.name === currentPlanName;
          const isProfessional = plan.name === "LogiTrack Profesional";

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${
                isCurrentPlan
                  ? "border-2 border-primary shadow-lg"
                  : isProfessional
                  ? "border-2 border-accent shadow-md"
                  : ""
              }`}
            >
              {isCurrentPlan && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Tu Plan
                </Badge>
              )}
              {isProfessional && !isCurrentPlan && (
                <Badge variant="secondary" className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Más Popular
                </Badge>
              )}
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-2 p-3 rounded-full bg-primary/10">
                  <Icon className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="text-center">
                  <span className="text-4xl font-bold">${plan.price_monthly.toLocaleString("es-AR")}</span>
                  <span className="text-muted-foreground"> /mes</span>
                </div>
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {isCurrentPlan ? (
                  <Button className="w-full" variant="outline" disabled>
                    Plan Actual
                  </Button>
                ) : subscription?.subscribed ? (
                  <Button
                    className="w-full"
                    variant={isProfessional ? "default" : "outline"}
                    onClick={() => handleSubscribe(plan)}
                  >
                    Cambiar Plan
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={isProfessional ? "default" : "outline"}
                    onClick={() => handleSubscribe(plan)}
                  >
                    Suscribirse
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Features comparison note */}
      <div className="text-center text-sm text-muted-foreground">
        <p>Todos los planes incluyen actualizaciones automáticas y soporte técnico.</p>
        <p>Los límites de -1 indican uso ilimitado. El contador de envíos se reinicia cada mes.</p>
        <p className="mt-2 text-primary">Pagos procesados de forma segura con Mercado Pago</p>
      </div>

      {/* Cancel Subscription Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar suscripción?</AlertDialogTitle>
            <AlertDialogDescription>
              Tu suscripción permanecerá activa hasta el final del período de facturación actual. 
              Después de eso, perderás acceso a las funciones premium.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mantener suscripción</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelSubscription}
              className="bg-destructive hover:bg-destructive/90"
              disabled={isCancelling}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelando...
                </>
              ) : (
                "Sí, cancelar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

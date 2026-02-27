import { Link } from "react-router-dom";
import { Building2, CreditCard, Users, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/lib/auth";
import SuperAdminSubscriptionManager from "@/components/subscriptions/SuperAdminSubscriptionManager";

export default function Subscription() {
  const { isSuperAdmin } = useAuth();

  // If super admin, render the management panel
  if (isSuperAdmin()) {
    return <SuperAdminSubscriptionManager />;
  }

  return <TenantSubscriptionView />;
}

function TenantSubscriptionView() {
  const {
    subscription,
    isLoading,
    getUsagePercentage,
  } = useSubscription();

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Mi Suscripción</h1>
        <p className="text-muted-foreground mt-1">
          Información sobre tu plan actual
        </p>
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
              <Badge variant="default">{subscription.plan_name}</Badge>
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
                Vencimiento: {new Date(subscription.subscription_end).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Contact Support Card */}
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
          <div className="p-4 rounded-full bg-primary/10">
            <CreditCard className="h-10 w-10 text-primary" />
          </div>
          <div className="space-y-2 max-w-md">
            <h2 className="text-xl font-semibold">Gestión de Suscripción</h2>
            <p className="text-muted-foreground">
              Para renovar, cambiar de plan o informar sobre un pago, contacta al equipo de soporte de Geologistick.
            </p>
          </div>
          <Button asChild size="lg">
            <Link to="/support">Contactar Soporte</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

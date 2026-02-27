import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Building2, Users, CreditCard, Bell, Crown, Zap, CheckCircle,
  XCircle, Clock, DollarSign, Plus, Send, Loader2, AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface TenantWithSubscription {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
  plan: string | null;
  tenant_subscriptions: {
    id: string;
    status: string;
    plan_id: string;
    current_period_end: string | null;
    subscription_plans: { name: string; price_monthly: number } | null;
  }[] | null;
}

interface PaymentRow {
  id: string;
  amount: number;
  payment_method: string;
  status: string;
  reference: string | null;
  period_start: string | null;
  period_end: string | null;
  notes: string | null;
  created_at: string;
  tenants: { nombre: string } | null;
  subscription_plans: { name: string } | null;
}

export default function SuperAdminSubscriptionManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Dialog states
  const [assignPlanOpen, setAssignPlanOpen] = useState(false);
  const [registerPaymentOpen, setRegisterPaymentOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantWithSubscription | null>(null);

  // Form states
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifType, setNotifType] = useState("info");
  const [periodEnd, setPeriodEnd] = useState("");

  // Queries - separate queries to avoid PostgREST RLS nested select issues
  const { data: tenants, isLoading: loadingTenants } = useQuery({
    queryKey: ["admin-tenants-subscriptions"],
    queryFn: async () => {
      // Query 1: Get all tenants
      const { data: tenantsData, error: tenantsError } = await supabase
        .from("tenants")
        .select("id, nombre, slug, activo, plan")
        .order("nombre");
      if (tenantsError) throw tenantsError;

      // Query 2: Get all subscriptions with their plans
      const { data: subsData, error: subsError } = await supabase
        .from("tenant_subscriptions")
        .select("id, tenant_id, status, plan_id, current_period_end, subscription_plans ( name, price_monthly )");
      if (subsError) throw subsError;

      // Merge in JS
      return (tenantsData || []).map(t => ({
        ...t,
        tenant_subscriptions: (subsData || [])
          .filter(s => s.tenant_id === t.id)
          .map(s => ({ id: s.id, status: s.status, plan_id: s.plan_id, current_period_end: s.current_period_end, subscription_plans: s.subscription_plans }))
          .length > 0
          ? (subsData || [])
              .filter(s => s.tenant_id === t.id)
              .map(s => ({ id: s.id, status: s.status, plan_id: s.plan_id, current_period_end: s.current_period_end, subscription_plans: s.subscription_plans }))
          : null,
      })) as TenantWithSubscription[];
    },
  });

  const { data: plans } = useQuery({
    queryKey: ["admin-subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: payments, isLoading: loadingPayments } = useQuery({
    queryKey: ["admin-subscription-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_payments")
        .select(`
          id, amount, payment_method, status, reference,
          period_start, period_end, notes, created_at,
          tenants ( nombre ),
          subscription_plans ( name )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as PaymentRow[];
    },
  });

  // Mutations
  const assignPlanMutation = useMutation({
    mutationFn: async ({ tenantId, planId, periodEndDate }: { tenantId: string; planId: string; periodEndDate: string }) => {
      const now = new Date();
      // Use the selected date, setting it to end of day UTC
      const endDate = new Date(periodEndDate + "T23:59:59Z");

      const { error } = await supabase
        .from("tenant_subscriptions")
        .upsert({
          tenant_id: tenantId,
          plan_id: planId,
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: endDate.toISOString(),
          cancel_at_period_end: false,
        }, { onConflict: "tenant_id" });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      toast.success("Plan asignado correctamente");
      queryClient.invalidateQueries({ queryKey: ["admin-tenants-subscriptions"] });
      // Auto-clear expiry notifications for this tenant
      clearExpiryNotifications(variables.tenantId);
      setAssignPlanOpen(false);
      resetForms();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const registerPaymentMutation = useMutation({
    mutationFn: async (params: {
      tenantId: string; planId: string; amount: number;
      method: string; reference: string; notes: string;
    }) => {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const { error } = await supabase
        .from("subscription_payments")
        .insert({
          tenant_id: params.tenantId,
          plan_id: params.planId,
          amount: params.amount,
          payment_method: params.method,
          status: "paid",
          reference: params.reference || null,
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
          notes: params.notes || null,
          created_by: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      toast.success("Pago registrado correctamente");
      queryClient.invalidateQueries({ queryKey: ["admin-subscription-payments"] });
      // Auto-clear expiry notifications for this tenant
      clearExpiryNotifications(variables.tenantId);
      setRegisterPaymentOpen(false);
      resetForms();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from("subscription_payments")
        .update({ status: "paid" })
        .eq("id", paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pago acreditado");
      queryClient.invalidateQueries({ queryKey: ["admin-subscription-payments"] });
    },
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async ({ tenantId, title, message, type }: {
      tenantId: string; title: string; message: string; type: string;
    }) => {
      // Find admin users for this tenant
      const { data: adminProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("tenant_id", tenantId);
      if (profilesError) throw profilesError;

      if (!adminProfiles?.length) {
        throw new Error("No se encontraron usuarios en este tenant");
      }

      const userIds = adminProfiles.map(p => p.user_id);
      const { data: adminRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("user_id", userIds)
        .eq("role", "admin");
      if (rolesError) throw rolesError;

      const adminUserIds = adminRoles?.map(r => r.user_id) || [];
      if (!adminUserIds.length) {
        throw new Error("No se encontraron admins en este tenant");
      }

      const notifications = adminUserIds.map(uid => ({
        user_id: uid,
        tenant_id: tenantId,
        title,
        message,
        type,
        read: false,
      }));

      const { error } = await supabase.from("notifications").insert(notifications);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notificación enviada a los admins del tenant");
      setNotifyOpen(false);
      resetForms();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getDefaultPeriodEnd = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  };

  const clearExpiryNotifications = async (tenantId: string) => {
    try {
      // Find unread expiry notifications for this tenant
      const { data: notifs } = await supabase
        .from("notifications")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("read", false)
        .like("link", `subscription-expiry-${tenantId}%`);

      if (notifs?.length) {
        await supabase
          .from("notifications")
          .update({ read: true })
          .in("id", notifs.map(n => n.id));
      }
    } catch (e) {
      console.error("Error clearing expiry notifications:", e);
    }
  };

  const resetForms = () => {
    setSelectedPlanId("");
    setPeriodEnd("");
    setPaymentMethod("efectivo");
    setPaymentAmount("");
    setPaymentReference("");
    setPaymentNotes("");
    setNotifTitle("");
    setNotifMessage("");
    setNotifType("info");
  };

  const openAssignPlan = (tenant: TenantWithSubscription) => {
    setSelectedTenant(tenant);
    const currentPlanId = tenant.tenant_subscriptions?.[0]?.plan_id || "";
    setSelectedPlanId(currentPlanId);
    const existingEnd = tenant.tenant_subscriptions?.[0]?.current_period_end;
    setPeriodEnd(existingEnd ? existingEnd.split("T")[0] : getDefaultPeriodEnd());
    setAssignPlanOpen(true);
  };

  const openRegisterPayment = (tenant: TenantWithSubscription) => {
    setSelectedTenant(tenant);
    const sub = tenant.tenant_subscriptions?.[0];
    if (sub?.subscription_plans?.price_monthly) {
      setPaymentAmount(sub.subscription_plans.price_monthly.toString());
    }
    setSelectedPlanId(sub?.plan_id || "");
    setRegisterPaymentOpen(true);
  };

  const openNotify = (tenant: TenantWithSubscription) => {
    setSelectedTenant(tenant);
    setNotifyOpen(true);
  };

  // Stats
  const totalTenants = tenants?.length || 0;
  const activeSubscriptions = tenants?.filter(t =>
    t.tenant_subscriptions?.[0]?.status === "active"
  ).length || 0;
  const noplan = totalTenants - activeSubscriptions;
  const pendingPayments = payments?.filter(p => p.status === "pending").length || 0;

  const getStatusBadge = (status: string | undefined) => {
    if (!status) return <Badge variant="outline">Sin plan</Badge>;
    switch (status) {
      case "active": return <Badge className="bg-green-600 text-white">Activo</Badge>;
      case "pending": return <Badge className="bg-yellow-500 text-white">Pendiente</Badge>;
      case "cancelled": return <Badge variant="destructive">Cancelado</Badge>;
      case "trial": return <Badge variant="secondary">Trial</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "paid": return <Badge className="bg-green-600 text-white">Acreditado</Badge>;
      case "pending": return <Badge className="bg-yellow-500 text-white">Pendiente</Badge>;
      case "failed": return <Badge variant="destructive">Fallido</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const methodLabel = (m: string) => {
    switch (m) {
      case "efectivo": return "Efectivo";
      case "transferencia": return "Transferencia";
      case "mercadopago": return "Mercado Pago";
      default: return m;
    }
  };

  if (loadingTenants) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gestión de Suscripciones</h1>
        <p className="text-muted-foreground mt-1">
          Administra los planes y pagos de todas las empresas
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Total Empresas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalTenants}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> Con Suscripción
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{activeSubscriptions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4" /> Sin Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-muted-foreground">{noplan}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Pagos Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{pendingPayments}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="empresas">
        <TabsList>
          <TabsTrigger value="empresas">Empresas y Planes</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
        </TabsList>

        <TabsContent value="empresas" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants?.map(tenant => {
                    const sub = tenant.tenant_subscriptions?.[0];
                    return (
                      <TableRow key={tenant.id}>
                        <TableCell className="font-medium">{tenant.nombre}</TableCell>
                        <TableCell>
                          {sub?.subscription_plans?.name ? (
                            <Badge variant="secondary">{sub.subscription_plans.name}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Sin plan</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(sub?.status)}</TableCell>
                        <TableCell>
                          {sub?.current_period_end
                            ? format(new Date(sub.current_period_end), "dd/MM/yyyy", { locale: es })
                            : "-"
                          }
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="outline" onClick={() => openAssignPlan(tenant)}>
                            <Crown className="h-3 w-3 mr-1" /> Plan
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openRegisterPayment(tenant)}>
                            <DollarSign className="h-3 w-3 mr-1" /> Pago
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openNotify(tenant)}>
                            <Bell className="h-3 w-3 mr-1" /> Notificar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!tenants || tenants.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No hay empresas registradas
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagos" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPayments ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : payments?.length ? (
                    payments.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.tenants?.nombre || "-"}</TableCell>
                        <TableCell>{p.subscription_plans?.name || "-"}</TableCell>
                        <TableCell>${p.amount.toLocaleString("es-AR")}</TableCell>
                        <TableCell>{methodLabel(p.payment_method)}</TableCell>
                        <TableCell>{getPaymentStatusBadge(p.status)}</TableCell>
                        <TableCell className="text-sm">
                          {p.period_start && p.period_end
                            ? `${format(new Date(p.period_start), "dd/MM")} - ${format(new Date(p.period_end), "dd/MM")}`
                            : "-"
                          }
                        </TableCell>
                        <TableCell className="text-sm">{p.reference || "-"}</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(p.created_at), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          {p.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markPaidMutation.mutate(p.id)}
                              disabled={markPaidMutation.isPending}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" /> Acreditar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        No hay pagos registrados
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assign Plan Dialog */}
      <Dialog open={assignPlanOpen} onOpenChange={setAssignPlanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Plan - {selectedTenant?.nombre}</DialogTitle>
            <DialogDescription>
              Selecciona un plan para activar inmediatamente en esta empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} - ${p.price_monthly.toLocaleString("es-AR")}/mes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vencimiento</Label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignPlanOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => selectedTenant && assignPlanMutation.mutate({
                tenantId: selectedTenant.id,
                planId: selectedPlanId,
                periodEndDate: periodEnd,
              })}
              disabled={!selectedPlanId || !periodEnd || assignPlanMutation.isPending}
            >
              {assignPlanMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Asignar Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Register Payment Dialog */}
      <Dialog open={registerPaymentOpen} onOpenChange={setRegisterPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago - {selectedTenant?.nombre}</DialogTitle>
            <DialogDescription>
              Registra un pago manual (efectivo, transferencia, etc.)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={selectedPlanId} onValueChange={(v) => {
                setSelectedPlanId(v);
                const plan = plans?.find(p => p.id === v);
                if (plan) setPaymentAmount(plan.price_monthly.toString());
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} - ${p.price_monthly.toLocaleString("es-AR")}/mes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Método de pago</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Referencia (recibo, comprobante, etc.)</Label>
              <Input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="REC-001, CBU-xxx, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Notas adicionales..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterPaymentOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => selectedTenant && registerPaymentMutation.mutate({
                tenantId: selectedTenant.id,
                planId: selectedPlanId,
                amount: parseFloat(paymentAmount),
                method: paymentMethod,
                reference: paymentReference,
                notes: paymentNotes,
              })}
              disabled={!selectedPlanId || !paymentAmount || registerPaymentMutation.isPending}
            >
              {registerPaymentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Registrar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notify Dialog */}
      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Notificación - {selectedTenant?.nombre}</DialogTitle>
            <DialogDescription>
              Se enviará a todos los administradores de esta empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={notifType} onValueChange={setNotifType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Información</SelectItem>
                  <SelectItem value="warning">Advertencia</SelectItem>
                  <SelectItem value="success">Éxito</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="Título de la notificación"
              />
            </div>
            <div className="space-y-2">
              <Label>Mensaje</Label>
              <Textarea
                value={notifMessage}
                onChange={(e) => setNotifMessage(e.target.value)}
                placeholder="Mensaje de la notificación..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => selectedTenant && sendNotificationMutation.mutate({
                tenantId: selectedTenant.id,
                title: notifTitle,
                message: notifMessage,
                type: notifType,
              })}
              disabled={!notifTitle || !notifMessage || sendNotificationMutation.isPending}
            >
              {sendNotificationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

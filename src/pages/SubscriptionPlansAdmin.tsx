import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Package, Users, Building2, Truck, DollarSign, CreditCard, FileDown } from "lucide-react";
import { generateAcuerdoComercialPDF } from "@/lib/generateAcuerdoComercialPDF";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  stripe_product_id: string;
  stripe_price_id: string;
  max_users: number;
  max_branches: number;
  max_shipments_month: number;
  price_monthly: number;
  features: string[];
  is_active: boolean;
  visible_in_landing: boolean;
  display_order: number;
}

const SubscriptionPlansAdmin = () => {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<SubscriptionPlan>>({});

  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin-subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return (data || []).map(plan => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features as string || "[]"),
      })) as SubscriptionPlan[];
    },
    enabled: isSuperAdmin,
  });

  const saveMutation = useMutation({
    mutationFn: async (plan: Partial<SubscriptionPlan>) => {
      const { features, id, ...rest } = plan;

      if (id) {
        const { error } = await supabase
          .from("subscription_plans")
          .update({
            ...rest,
            features: features || [],
          })
          .eq("id", id);
        if (error) throw error;
      } else {
        const insertData = {
          name: rest.name || "",
          stripe_price_id: rest.stripe_price_id || "",
          stripe_product_id: rest.stripe_product_id || "",
          max_users: rest.max_users || 5,
          max_branches: rest.max_branches || 1,
          max_shipments_month: rest.max_shipments_month || 100,
          price_monthly: rest.price_monthly || 0,
          description: rest.description,
          display_order: rest.display_order || 1,
          is_active: rest.is_active ?? true,
          visible_in_landing: (rest as any).visible_in_landing ?? true,
          features: features || [],
        };
        const { error } = await supabase
          .from("subscription_plans")
          .insert(insertData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-subscription-plans"] });
      toast.success("Plan guardado correctamente");
      setIsDialogOpen(false);
      setEditingPlan(null);
      setFormData({});
    },
    onError: (error: any) => {
      toast.error("Error al guardar: " + error.message);
    },
  });

  const handleEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData(plan);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingPlan(null);
    setFormData({
      name: "",
      description: "",
      stripe_product_id: "",
      stripe_price_id: "",
      max_users: 5,
      max_branches: 1,
      max_shipments_month: 100,
      price_monthly: 0,
      features: [],
      is_active: true,
      visible_in_landing: true,
      display_order: (plans?.length || 0) + 1,
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.stripe_price_id) {
      toast.error("Nombre y Stripe Price ID son requeridos");
      return;
    }
    saveMutation.mutate(formData);
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isSuperAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">No tienes permisos para acceder a esta página</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Planes de Suscripción</h1>
            <p className="text-muted-foreground">Administra los planes y precios del sistema</p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Plan
          </Button>
        </div>

        {/* Stats cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Planes</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{plans?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Planes Activos</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{plans?.filter(p => p.is_active).length || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Plans table */}
        <Card>
          <CardHeader>
            <CardTitle>Planes Configurados</CardTitle>
            <CardDescription>
              Estos planes se sincronizan con Stripe. El precio real se cobra según el price_id configurado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Orden</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Precio/mes</TableHead>
                  <TableHead>Límites</TableHead>
                  <TableHead>Stripe Price ID</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans?.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.display_order}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{plan.name}</div>
                        <div className="text-sm text-muted-foreground">{plan.description}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{plan.price_monthly.toLocaleString()}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {plan.max_users === -1 ? "∞" : plan.max_users} usuarios
                        </div>
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {plan.max_branches === -1 ? "∞" : plan.max_branches} sucursales
                        </div>
                        <div className="flex items-center gap-1">
                          <Truck className="h-3 w-3" />
                          {plan.max_shipments_month === -1 ? "∞" : plan.max_shipments_month} envíos/mes
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {plan.stripe_price_id.slice(0, 20)}...
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={plan.is_active ? "default" : "secondary"}>
                          {plan.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                        <Badge variant={plan.visible_in_landing ? "outline" : "secondary"} className="text-xs">
                          {plan.visible_in_landing ? "Público" : "Oculto"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(plan)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit/Create Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPlan ? "Editar Plan" : "Nuevo Plan"}</DialogTitle>
              <DialogDescription>
                Configura los detalles del plan de suscripción
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del Plan</Label>
                  <Input
                    id="name"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Professional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order">Orden de visualización</Label>
                  <Input
                    id="order"
                    type="number"
                    value={formData.display_order || 1}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ej: Para empresas en crecimiento"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stripe_product_id">Stripe Product ID</Label>
                  <Input
                    id="stripe_product_id"
                    value={formData.stripe_product_id || ""}
                    onChange={(e) => setFormData({ ...formData, stripe_product_id: e.target.value })}
                    placeholder="prod_xxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stripe_price_id">Stripe Price ID *</Label>
                  <Input
                    id="stripe_price_id"
                    value={formData.stripe_price_id || ""}
                    onChange={(e) => setFormData({ ...formData, stripe_price_id: e.target.value })}
                    placeholder="price_xxx"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price_monthly">Precio Mensual (para mostrar)</Label>
                <Input
                  id="price_monthly"
                  type="number"
                  value={formData.price_monthly || 0}
                  onChange={(e) => setFormData({ ...formData, price_monthly: parseFloat(e.target.value) })}
                  placeholder="15000"
                />
                <p className="text-xs text-muted-foreground">
                  Este es el precio que se muestra en la UI. El cobro real es según Stripe.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max_users">Máx. Usuarios</Label>
                  <Input
                    id="max_users"
                    type="number"
                    value={formData.max_users || 0}
                    onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">-1 = ilimitado</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_branches">Máx. Sucursales</Label>
                  <Input
                    id="max_branches"
                    type="number"
                    value={formData.max_branches || 0}
                    onChange={(e) => setFormData({ ...formData, max_branches: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">-1 = ilimitado</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_shipments">Máx. Envíos/Mes</Label>
                  <Input
                    id="max_shipments"
                    type="number"
                    value={formData.max_shipments_month || 0}
                    onChange={(e) => setFormData({ ...formData, max_shipments_month: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">-1 = ilimitado</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="features">Características (una por línea)</Label>
                <textarea
                  id="features"
                  className="w-full min-h-[100px] px-3 py-2 border rounded-md text-sm"
                  value={(formData.features || []).join("\n")}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    features: e.target.value.split("\n").filter(f => f.trim()) 
                  })}
                  placeholder="Tracking GPS en vivo&#10;Planificación de rutas con IA&#10;Soporte prioritario"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active ?? true}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Plan activo</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="visible_in_landing"
                  checked={(formData as any).visible_in_landing ?? true}
                  onCheckedChange={(checked) => setFormData({ ...formData, visible_in_landing: checked } as any)}
                />
                <Label htmlFor="visible_in_landing">Visible en página principal</Label>
                <p className="text-xs text-muted-foreground ml-2">
                  Si se desactiva, el plan no aparecerá en la landing pero sí podrá asignarse manualmente.
                </p>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              {editingPlan && (
                <Button
                  variant="secondary"
                  className="mr-auto"
                  onClick={() => {
                    generateAcuerdoComercialPDF({
                      tenantName: '',
                      planName: formData.name || '',
                      planDescription: formData.description || undefined,
                      priceMonthly: formData.price_monthly || 0,
                      maxUsers: formData.max_users || 0,
                      maxBranches: formData.max_branches || 0,
                      maxShipmentsMonth: formData.max_shipments_month || 0,
                      features: formData.features || [],
                    });
                  }}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Descargar Acuerdo
                </Button>
              )}
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default SubscriptionPlansAdmin;

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { DraftIndicator, DraftSavingIndicator } from "@/components/ui/draft-indicator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  DollarSign,
  Users,
  CheckCircle,
  XCircle,
  Tag,
} from "lucide-react";
import { ThirdPartyRatesDialog } from "@/components/settlements/ThirdPartyRatesDialog";
import { format } from "date-fns";

const PROVINCIAS_ARGENTINA = [
  "Buenos Aires",
  "CABA",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];

interface EmpresaTerciarizada {
  id: string;
  codigo: string;
  nombre: string;
  razon_social: string | null;
  cuit: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  ciudad: string | null;
  provincia: string | null;
  codigo_postal: string | null;
  notas: string | null;
  tiene_cuenta_corriente: boolean;
  limite_credito: number;
  saldo_cuenta_corriente: number;
  activa: boolean;
  incluye_iva: boolean;
  porcentaje_iva: number;
  created_at: string;
}

interface FormData {
  codigo: string;
  nombre: string;
  razon_social: string;
  cuit: string;
  telefono: string;
  email: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  codigo_postal: string;
  notas: string;
  tiene_cuenta_corriente: boolean;
  limite_credito: number;
  activa: boolean;
  incluye_iva: boolean;
  porcentaje_iva: number;
}

const emptyForm: FormData = {
  codigo: "",
  nombre: "",
  razon_social: "",
  cuit: "",
  telefono: "",
  email: "",
  direccion: "",
  ciudad: "",
  provincia: "",
  codigo_postal: "",
  notas: "",
  tiene_cuenta_corriente: false,
  limite_credito: 0,
  activa: true,
  incluye_iva: false,
  porcentaje_iva: 21,
};

export default function ThirdPartyCompanies() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [ratesEmpresa, setRatesEmpresa] = useState<EmpresaTerciarizada | null>(null);

  // Form draft persistence
  const {
    formData,
    setFormData,
    clearDraft,
    discardDraft,
    isDraftRecovered,
    setIsDraftRecovered,
    lastSaved,
    hasDraft,
  } = useFormDraft<FormData>("new-third-party", emptyForm);

  // Fetch companies
  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["empresas-terciarizadas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas_terciarizadas")
        .select("*")
        .order("nombre");

      if (error) throw error;
      return data as EmpresaTerciarizada[];
    },
    refetchOnWindowFocus: false,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("empresas_terciarizadas").insert({
        ...data,
        tenant_id: profile?.tenant_id,
        created_by: profile?.user_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas-terciarizadas"] });
      toast.success("Empresa creada correctamente");
      clearDraft();
      closeDialog();
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const { error } = await supabase
        .from("empresas_terciarizadas")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas-terciarizadas"] });
      toast.success("Empresa actualizada correctamente");
      closeDialog();
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("empresas_terciarizadas")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas-terciarizadas"] });
      toast.success("Empresa eliminada correctamente");
      setDeleteConfirmId(null);
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const openCreateDialog = () => {
    setEditingId(null);
    // Don't reset form - use draft if available
    setIsDialogOpen(true);
  };

  const openEditDialog = (empresa: EmpresaTerciarizada) => {
    discardDraft(); // Clear draft when editing existing
    setFormData({
      codigo: empresa.codigo,
      nombre: empresa.nombre,
      razon_social: empresa.razon_social || "",
      cuit: empresa.cuit || "",
      telefono: empresa.telefono || "",
      email: empresa.email || "",
      direccion: empresa.direccion || "",
      ciudad: empresa.ciudad || "",
      provincia: empresa.provincia || "",
      codigo_postal: empresa.codigo_postal || "",
      notas: empresa.notas || "",
      tiene_cuenta_corriente: empresa.tiene_cuenta_corriente,
      limite_credito: empresa.limite_credito,
      activa: empresa.activa,
      incluye_iva: empresa.incluye_iva ?? false,
      porcentaje_iva: empresa.porcentaje_iva ?? 21,
    });
    setEditingId(empresa.id);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.codigo) {
      toast.error("El código es requerido");
      return;
    }
    if (!formData.nombre) {
      toast.error("El nombre es requerido");
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Filter companies
  const filteredEmpresas = empresas.filter(
    (e) =>
      e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.cuit?.includes(searchTerm)
  );

  // Stats
  const totalEmpresas = empresas.length;
  const conCtaCte = empresas.filter((e) => e.tiene_cuenta_corriente).length;
  const activas = empresas.filter((e) => e.activa).length;
  const saldoTotal = empresas.reduce((sum, e) => sum + (e.saldo_cuenta_corriente || 0), 0);

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Empresas Terciarizadas</h1>
          <p className="text-muted-foreground">Gestiona las empresas de transporte tercerizado</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Empresa
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalEmpresas}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{conCtaCte}</p>
                <p className="text-sm text-muted-foreground">Con Cta. Cte.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activas}</p>
                <p className="text-sm text-muted-foreground">Activas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className={`text-2xl font-bold ${saldoTotal < 0 ? "text-destructive" : ""}`}>
                  ${saldoTotal.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Saldo Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, código o CUIT..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEmpresas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm ? "No se encontraron empresas" : "No hay empresas registradas"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CUIT</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmpresas.map((empresa) => (
                  <TableRow key={empresa.id}>
                    <TableCell className="font-mono font-medium">{empresa.codigo}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{empresa.nombre}</p>
                        {empresa.tiene_cuenta_corriente && (
                          <Badge variant="outline" className="text-xs mt-1">
                            Cta. Cte.
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{empresa.cuit || "-"}</TableCell>
                    <TableCell>{empresa.telefono || "-"}</TableCell>
                    <TableCell className="text-right">
                      {empresa.tiene_cuenta_corriente ? (
                        <span
                          className={
                            empresa.saldo_cuenta_corriente < 0
                              ? "text-destructive font-medium"
                              : "text-muted-foreground"
                          }
                        >
                          ${empresa.saldo_cuenta_corriente.toLocaleString()}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {empresa.activa ? (
                        <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-200">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Activa
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="mr-1 h-3 w-3" />
                          Inactiva
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Tarifas"
                          onClick={() => setRatesEmpresa(empresa)}
                        >
                          <Tag className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(empresa)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(empresa.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Empresa" : "Nueva Empresa Terciarizada"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Modifica los datos de la empresa"
                : "Registra una nueva empresa de transporte tercerizado"}
            </DialogDescription>
          </DialogHeader>

          {/* Draft indicator */}
          {!editingId && isDraftRecovered && (
            <DraftIndicator
              lastSaved={lastSaved}
              onDiscard={discardDraft}
              onDismiss={() => setIsDraftRecovered(false)}
              className="mb-2"
            />
          )}

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Información Básica
              </h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Código *</Label>
                  <Input
                    placeholder="Ej: CA, OCA, AND"
                    value={formData.codigo}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, codigo: e.target.value.toUpperCase() }))
                    }
                    maxLength={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input
                    placeholder="Nombre de la empresa"
                    value={formData.nombre}
                    onChange={(e) => setFormData((p) => ({ ...p, nombre: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Razón Social</Label>
                  <Input
                    placeholder="Razón social para facturación"
                    value={formData.razon_social}
                    onChange={(e) => setFormData((p) => ({ ...p, razon_social: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CUIT</Label>
                  <Input
                    placeholder="30-12345678-9"
                    value={formData.cuit}
                    onChange={(e) => setFormData((p) => ({ ...p, cuit: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Contacto
              </h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    placeholder="Teléfono de contacto"
                    value={formData.telefono}
                    onChange={(e) => setFormData((p) => ({ ...p, telefono: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="email@empresa.com"
                    value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Dirección
              </h4>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input
                  placeholder="Calle y número"
                  value={formData.direccion}
                  onChange={(e) => setFormData((p) => ({ ...p, direccion: e.target.value }))}
                />
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Input
                    placeholder="Ciudad"
                    value={formData.ciudad}
                    onChange={(e) => setFormData((p) => ({ ...p, ciudad: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Provincia</Label>
                  <Select
                    value={formData.provincia}
                    onValueChange={(value) => setFormData((p) => ({ ...p, provincia: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVINCIAS_ARGENTINA.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>C.P.</Label>
                  <Input
                    placeholder="Código postal"
                    value={formData.codigo_postal}
                    onChange={(e) => setFormData((p) => ({ ...p, codigo_postal: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Current Account */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Cuenta Corriente
              </h4>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Habilitar Cuenta Corriente</p>
                  <p className="text-sm text-muted-foreground">
                    Permite registrar cargos y pagos con esta empresa
                  </p>
                </div>
                <Switch
                  checked={formData.tiene_cuenta_corriente}
                  onCheckedChange={(checked) =>
                    setFormData((p) => ({ ...p, tiene_cuenta_corriente: checked }))
                  }
                />
              </div>
              {formData.tiene_cuenta_corriente && (
                <div className="space-y-2">
                  <Label>Límite de Crédito</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={formData.limite_credito}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, limite_credito: parseFloat(e.target.value) || 0 }))
                    }
                  />
                </div>
              )}
            </div>

            {/* IVA Configuration */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Configuración de IVA
              </h4>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Incluye IVA</p>
                  <p className="text-sm text-muted-foreground">
                    Indica si los montos de esta empresa incluyen IVA
                  </p>
                </div>
                <Switch
                  checked={formData.incluye_iva}
                  onCheckedChange={(checked) =>
                    setFormData((p) => ({ ...p, incluye_iva: checked }))
                  }
                />
              </div>
              {formData.incluye_iva && (
                <div className="space-y-2">
                  <Label>Porcentaje de IVA (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    placeholder="21"
                    value={formData.porcentaje_iva}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, porcentaje_iva: parseFloat(e.target.value) || 21 }))
                    }
                  />
                </div>
              )}
            </div>

            {/* Notes and Status */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  placeholder="Observaciones adicionales"
                  value={formData.notas}
                  onChange={(e) => setFormData((p) => ({ ...p, notas: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Empresa Activa</p>
                  <p className="text-sm text-muted-foreground">
                    Las empresas inactivas no aparecen en los selectores
                  </p>
                </div>
                <Switch
                  checked={formData.activa}
                  onCheckedChange={(checked) => setFormData((p) => ({ ...p, activa: checked }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Guardar Cambios" : "Crear Empresa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar empresa?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminarán todos los datos asociados a esta
              empresa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ThirdPartyRatesDialog
        open={!!ratesEmpresa}
        onOpenChange={(v) => { if (!v) setRatesEmpresa(null); }}
        empresa={ratesEmpresa ? { id: ratesEmpresa.id, nombre: ratesEmpresa.nombre, tenant_id: (ratesEmpresa as any).tenant_id } : null}
      />
    </div>
  );
}

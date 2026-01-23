import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DollarSign,
  Plus,
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  CreditCard,
  Package,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface EmpresaTerciarizada {
  id: string;
  codigo: string;
  nombre: string;
  cuit: string | null;
  tiene_cuenta_corriente: boolean;
  limite_credito: number;
  saldo_cuenta_corriente: number;
}

interface Movimiento {
  id: string;
  empresa_id: string;
  envio_id: string | null;
  tipo: "cargo" | "pago" | "ajuste";
  monto: number;
  saldo_anterior: number;
  saldo_nuevo: number;
  descripcion: string | null;
  referencia: string | null;
  metodo_pago: string | null;
  created_at: string;
}

type PaymentMethod = "efectivo" | "transferencia" | "cheque" | "tarjeta" | "otro";

const METODOS_PAGO: { value: PaymentMethod; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia Bancaria" },
  { value: "cheque", label: "Cheque" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "otro", label: "Otro" },
];

export default function ThirdPartySettlements() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<"pago" | "ajuste">("pago");
  const [paymentForm, setPaymentForm] = useState({
    monto: 0,
    descripcion: "",
    referencia: "",
    metodo_pago: "transferencia" as PaymentMethod,
  });

  // Fetch companies with current account
  const { data: empresas = [], isLoading: loadingEmpresas } = useQuery({
    queryKey: ["empresas-terciarizadas-cta-cte"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas_terciarizadas")
        .select("id, codigo, nombre, cuit, tiene_cuenta_corriente, limite_credito, saldo_cuenta_corriente")
        .eq("tiene_cuenta_corriente", true)
        .eq("activa", true)
        .order("nombre");

      if (error) throw error;
      return data as EmpresaTerciarizada[];
    },
  });

  const selectedEmpresa = empresas.find((e) => e.id === selectedEmpresaId);

  // Fetch movements for selected company
  const { data: movimientos = [], isLoading: loadingMovimientos } = useQuery({
    queryKey: ["terciarizado-cuenta-corriente", selectedEmpresaId],
    queryFn: async () => {
      if (!selectedEmpresaId) return [];

      const { data, error } = await supabase
        .from("terciarizado_cuenta_corriente")
        .select("*")
        .eq("empresa_id", selectedEmpresaId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as Movimiento[];
    },
    enabled: !!selectedEmpresaId,
  });

  // Fetch pending shipments for selected company
  const { data: enviosPendientes = [], isLoading: loadingEnvios } = useQuery({
    queryKey: ["envios-terciarizados-empresa", selectedEmpresaId],
    queryFn: async () => {
      if (!selectedEmpresaId) return [];

      const { data, error } = await supabase
        .from("envios")
        .select("id, tracking_number, tracking_externo, nombre_destinatario, precio_total, created_at")
        .eq("empresa_terciarizada_id", selectedEmpresaId)
        .eq("es_terciarizado", true)
        .in("estado", ["pendiente", "recogido", "en_bodega", "en_transito"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedEmpresaId,
  });

  // Register payment mutation
  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmpresa) throw new Error("No hay empresa seleccionada");
      if (paymentForm.monto <= 0) throw new Error("El monto debe ser mayor a 0");

      const montoFinal = paymentType === "pago" ? -paymentForm.monto : paymentForm.monto;
      const nuevoSaldo = selectedEmpresa.saldo_cuenta_corriente + montoFinal;

      // Insert movement
      const { error: movError } = await supabase
        .from("terciarizado_cuenta_corriente")
        .insert({
          empresa_id: selectedEmpresa.id,
          tipo: paymentType,
          monto: montoFinal,
          saldo_anterior: selectedEmpresa.saldo_cuenta_corriente,
          saldo_nuevo: nuevoSaldo,
          descripcion: paymentForm.descripcion || (paymentType === "pago" ? "Pago registrado" : "Ajuste manual"),
          referencia: paymentForm.referencia || null,
          metodo_pago: paymentType === "pago" ? paymentForm.metodo_pago : null,
          created_by: profile?.user_id,
        });

      if (movError) throw movError;

      // Update company balance
      const { error: updateError } = await supabase
        .from("empresas_terciarizadas")
        .update({ saldo_cuenta_corriente: nuevoSaldo })
        .eq("id", selectedEmpresa.id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terciarizado-cuenta-corriente", selectedEmpresaId] });
      queryClient.invalidateQueries({ queryKey: ["empresas-terciarizadas-cta-cte"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-terciarizadas"] });
      toast.success(paymentType === "pago" ? "Pago registrado correctamente" : "Ajuste registrado correctamente");
      setIsPaymentDialogOpen(false);
      setPaymentForm({ monto: 0, descripcion: "", referencia: "", metodo_pago: "transferencia" });
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const openPaymentDialog = (type: "pago" | "ajuste") => {
    setPaymentType(type);
    setPaymentForm({ monto: 0, descripcion: "", referencia: "", metodo_pago: "transferencia" });
    setIsPaymentDialogOpen(true);
  };

  const getMovimientoIcon = (tipo: string) => {
    switch (tipo) {
      case "cargo":
        return <ArrowUpCircle className="h-4 w-4 text-destructive" />;
      case "pago":
        return <ArrowDownCircle className="h-4 w-4 text-green-500" />;
      case "ajuste":
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const creditoDisponible = selectedEmpresa
    ? selectedEmpresa.limite_credito - Math.abs(Math.min(0, selectedEmpresa.saldo_cuenta_corriente))
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Liquidaciones Terciarizados</h1>
        <p className="text-muted-foreground">Gestiona la cuenta corriente con empresas terciarizadas</p>
      </div>

      {/* Company Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label>Seleccionar Empresa</Label>
            <Select
              value={selectedEmpresaId || ""}
              onValueChange={(value) => setSelectedEmpresaId(value || null)}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Selecciona una empresa..." />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((empresa) => (
                  <SelectItem key={empresa.id} value={empresa.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span>{empresa.nombre}</span>
                      <span className="text-muted-foreground">({empresa.codigo})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Selected Company Details */}
      {selectedEmpresa && (
        <>
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{selectedEmpresa.nombre}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    CUIT: {selectedEmpresa.cuit || "No registrado"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => openPaymentDialog("ajuste")}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Ajuste Manual
                  </Button>
                  <Button onClick={() => openPaymentDialog("pago")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Registrar Pago
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Saldo Actual</p>
                  <p
                    className={`text-2xl font-bold ${
                      selectedEmpresa.saldo_cuenta_corriente < 0 ? "text-destructive" : "text-green-600"
                    }`}
                  >
                    ${selectedEmpresa.saldo_cuenta_corriente.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Límite de Crédito</p>
                  <p className="text-2xl font-bold">${selectedEmpresa.limite_credito.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Crédito Disponible</p>
                  <p className={`text-2xl font-bold ${creditoDisponible < 0 ? "text-destructive" : ""}`}>
                    ${creditoDisponible.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Movements History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Historial de Movimientos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingMovimientos ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : movimientos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No hay movimientos registrados</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimientos.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(mov.created_at), "dd/MM/yy HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getMovimientoIcon(mov.tipo)}
                            <Badge
                              variant={
                                mov.tipo === "cargo"
                                  ? "destructive"
                                  : mov.tipo === "pago"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {mov.tipo === "cargo"
                                ? "Cargo"
                                : mov.tipo === "pago"
                                ? "Pago"
                                : "Ajuste"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {mov.descripcion || "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{mov.referencia || "-"}</TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            mov.monto < 0 ? "text-green-600" : "text-destructive"
                          }`}
                        >
                          {mov.monto < 0 ? "+" : ""}${Math.abs(mov.monto).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${mov.saldo_nuevo.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Pending Shipments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Envíos Pendientes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingEnvios ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : enviosPendientes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No hay envíos pendientes</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tracking Externo</TableHead>
                      <TableHead>Destinatario</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enviosPendientes.map((envio) => (
                      <TableRow key={envio.id}>
                        <TableCell className="font-mono">{envio.tracking_externo || envio.tracking_number}</TableCell>
                        <TableCell>{envio.nombre_destinatario || "-"}</TableCell>
                        <TableCell>
                          {format(new Date(envio.created_at), "dd/MM/yy", { locale: es })}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${envio.precio_total?.toLocaleString() || "0"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* No company selected */}
      {!selectedEmpresaId && !loadingEmpresas && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-medium mb-2">Selecciona una empresa</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Elige una empresa terciarizada con cuenta corriente habilitada para ver sus movimientos y
              registrar pagos.
            </p>
            {empresas.length === 0 && (
              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg inline-flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">No hay empresas con cuenta corriente habilitada</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary table when no company is selected */}
      {!selectedEmpresaId && empresas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumen de Empresas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CUIT</TableHead>
                  <TableHead className="text-right">Límite Crédito</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Disponible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empresas.map((empresa) => {
                  const disponible =
                    empresa.limite_credito - Math.abs(Math.min(0, empresa.saldo_cuenta_corriente));
                  return (
                    <TableRow
                      key={empresa.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedEmpresaId(empresa.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{empresa.nombre}</span>
                          <Badge variant="outline">{empresa.codigo}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{empresa.cuit || "-"}</TableCell>
                      <TableCell className="text-right">
                        ${empresa.limite_credito.toLocaleString()}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          empresa.saldo_cuenta_corriente < 0 ? "text-destructive" : "text-green-600"
                        }`}
                      >
                        ${empresa.saldo_cuenta_corriente.toLocaleString()}
                      </TableCell>
                      <TableCell
                        className={`text-right ${disponible < 0 ? "text-destructive" : ""}`}
                      >
                        ${disponible.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Payment/Adjustment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {paymentType === "pago" ? "Registrar Pago" : "Ajuste Manual"}
            </DialogTitle>
            <DialogDescription>
              {paymentType === "pago"
                ? "Registra un pago recibido o realizado a la empresa"
                : "Realiza un ajuste manual al saldo de la cuenta corriente"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Monto *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={paymentForm.monto || ""}
                  onChange={(e) =>
                    setPaymentForm((p) => ({ ...p, monto: parseFloat(e.target.value) || 0 }))
                  }
                  className="pl-10"
                />
              </div>
              {paymentType === "ajuste" && (
                <p className="text-xs text-muted-foreground">
                  Use valores positivos para aumentar el saldo (cargo) o negativos para reducirlo
                  (abono)
                </p>
              )}
            </div>

            {paymentType === "pago" && (
              <div className="space-y-2">
                <Label>Método de Pago</Label>
                <Select
                  value={paymentForm.metodo_pago}
                  onValueChange={(value) =>
                    setPaymentForm((p) => ({ ...p, metodo_pago: value as PaymentMethod }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METODOS_PAGO.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Referencia</Label>
              <Input
                placeholder="Nro. de comprobante, factura, etc."
                value={paymentForm.referencia}
                onChange={(e) => setPaymentForm((p) => ({ ...p, referencia: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                placeholder="Descripción del movimiento"
                value={paymentForm.descripcion}
                onChange={(e) => setPaymentForm((p) => ({ ...p, descripcion: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => paymentMutation.mutate()} disabled={paymentMutation.isPending}>
              {paymentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {paymentType === "pago" ? "Registrar Pago" : "Aplicar Ajuste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

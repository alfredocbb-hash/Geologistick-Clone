import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Truck,
  Package,
  Loader2,
  Trash2,
  Plus,
  Building2,
  DollarSign,
  MapPin,
  Calendar,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { AddressAutocomplete, AddressDetails } from "@/components/maps/AddressAutocomplete";

interface EmpresaTerciarizada {
  id: string;
  codigo: string;
  nombre: string;
  tiene_cuenta_corriente: boolean;
  saldo_cuenta_corriente: number;
}

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

const TIPO_OPERACION = [
  { value: "entrega", label: "Entrega" },
  { value: "retiro", label: "Retiro" },
  { value: "cobro", label: "Cobro" },
];

interface ThirdPartyFormData {
  empresa_terciarizada: string;
  tracking_externo: string;
  codigo_cliente_externo: string;
  codigo_orden_externo: string;
  nombre_destinatario: string;
  direccion_entrega: string;
  ciudad_entrega: string;
  provincia: string;
  cp_entrega: string;
  tipo_operacion: string;
  fecha: string;
  duracion_estimada_minutos: number;
  notas: string;
  entrega_lat: number | null;
  entrega_lng: number | null;
}

interface TempShipment extends ThirdPartyFormData {
  id: string;
}

const emptyForm: ThirdPartyFormData = {
  empresa_terciarizada: "",
  tracking_externo: "",
  codigo_cliente_externo: "",
  codigo_orden_externo: "",
  nombre_destinatario: "",
  direccion_entrega: "",
  ciudad_entrega: "",
  provincia: "",
  cp_entrega: "",
  tipo_operacion: "entrega",
  fecha: format(new Date(), "yyyy-MM-dd"),
  duracion_estimada_minutos: 30,
  notas: "",
  entrega_lat: null,
  entrega_lng: null,
};

export default function ThirdPartyShipmentsTab() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<ThirdPartyFormData>(emptyForm);
  const [tempShipments, setTempShipments] = useState<TempShipment[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Fetch active third-party companies from database
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-terciarizadas-activas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas_terciarizadas")
        .select("id, codigo, nombre, tiene_cuenta_corriente, saldo_cuenta_corriente")
        .eq("activa", true)
        .order("nombre");

      if (error) throw error;
      return data as EmpresaTerciarizada[];
    },
  });

  // Fetch pending third-party shipments
  const { data: terciarizadosPendientes = [], isLoading } = useQuery({
    queryKey: ["envios-terciarizados-pendientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("envios")
        .select("*, empresa:empresas_terciarizadas(id, codigo, nombre)")
        .eq("es_terciarizado", true)
        .in("estado", ["pendiente", "recogido", "en_bodega"])
        .is("chofer_id", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const handleInputChange = (field: keyof ThirdPartyFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddressSelect = (details: AddressDetails) => {
    setFormData((prev) => ({
      ...prev,
      direccion_entrega: details.address || details.formattedAddress,
      ciudad_entrega: details.city || prev.ciudad_entrega,
      provincia: details.province || prev.provincia,
      cp_entrega: details.postalCode || prev.cp_entrega,
      entrega_lat: details.lat,
      entrega_lng: details.lng,
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.empresa_terciarizada) {
      toast.error("Selecciona la empresa terciarizada");
      return false;
    }
    if (!formData.tracking_externo) {
      toast.error("El tracking externo es requerido");
      return false;
    }
    if (!formData.nombre_destinatario) {
      toast.error("El nombre del destinatario es requerido");
      return false;
    }
    if (!formData.direccion_entrega) {
      toast.error("La dirección es requerida");
      return false;
    }
    if (!formData.ciudad_entrega) {
      toast.error("La ciudad es requerida");
      return false;
    }
    if (!formData.provincia) {
      toast.error("La provincia es requerida");
      return false;
    }
    return true;
  };

  const handleAddToList = () => {
    if (!validateForm()) return;

    const newShipment: TempShipment = {
      ...formData,
      id: crypto.randomUUID(),
    };

    setTempShipments((prev) => [...prev, newShipment]);
    setFormData(emptyForm);
    toast.success("Envío agregado a la lista");
  };

  const handleRemoveFromList = (id: string) => {
    setTempShipments((prev) => prev.filter((s) => s.id !== id));
    setSelectedIds((prev) => prev.filter((sid) => sid !== id));
  };

  const createShipmentMutation = useMutation({
    mutationFn: async (shipment: ThirdPartyFormData) => {
      // Find selected company details
      const selectedEmpresa = empresas.find((e) => e.id === shipment.empresa_terciarizada);
      
      // Generate tracking number
      const { data: trackingData } = await supabase.rpc("generate_tracking_number");

      const { data, error } = await supabase
        .from("envios")
        .insert({
          tenant_id: profile?.tenant_id,
          tracking_number: trackingData,
          es_terciarizado: true,
          empresa_terciarizada_id: shipment.empresa_terciarizada,
          empresa_terciarizada: selectedEmpresa?.nombre || shipment.empresa_terciarizada,
          tracking_externo: shipment.tracking_externo,
          codigo_cliente_externo: shipment.codigo_cliente_externo || null,
          codigo_orden_externo: shipment.codigo_orden_externo || null,
          nombre_destinatario: shipment.nombre_destinatario,
          direccion_entrega: shipment.direccion_entrega,
          ciudad_entrega: shipment.ciudad_entrega,
          provincia: shipment.provincia,
          cp_entrega: shipment.cp_entrega || null,
          entrega_lat: shipment.entrega_lat,
          entrega_lng: shipment.entrega_lng,
          tipo_servicio: "puerta_puerta",
          tipo_servicio_detalle: shipment.tipo_operacion === "retiro" ? "puerta_sucursal" : "sucursal_puerta",
          duracion_estimada_minutos: shipment.duracion_estimada_minutos,
          notas: shipment.notas || null,
          estado: "pendiente",
          precio_total: 0,
          sucursal_origen_id: profile?.sucursal_id,
          requiere_retiro: shipment.tipo_operacion === "retiro",
        })
        .select()
        .single();

      if (error) throw error;

      // If company has current account enabled, register a charge
      if (selectedEmpresa?.tiene_cuenta_corriente && data) {
        const nuevoSaldo = (selectedEmpresa.saldo_cuenta_corriente || 0) + (data.precio_total || 0);
        
        await supabase.from("terciarizado_cuenta_corriente").insert({
          empresa_id: selectedEmpresa.id,
          envio_id: data.id,
          tipo: "cargo",
          monto: data.precio_total || 0,
          saldo_anterior: selectedEmpresa.saldo_cuenta_corriente || 0,
          saldo_nuevo: nuevoSaldo,
          descripcion: `Envío ${shipment.tracking_externo} - ${shipment.nombre_destinatario}`,
          created_by: profile?.user_id,
        });

        // Update company balance
        await supabase
          .from("empresas_terciarizadas")
          .update({ saldo_cuenta_corriente: nuevoSaldo })
          .eq("id", selectedEmpresa.id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["envios-terciarizados-pendientes"] });
      queryClient.invalidateQueries({ queryKey: ["envios-planificador"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-terciarizadas-activas"] });
      queryClient.invalidateQueries({ queryKey: ["terciarizado-cuenta-corriente"] });
    },
    onError: (error: Error) => {
      toast.error(`Error al crear envío: ${error.message}`);
    },
  });

  const handleCreateSingle = async () => {
    if (!validateForm()) return;

    try {
      await createShipmentMutation.mutateAsync(formData);
      setFormData(emptyForm);
      toast.success("Envío terciarizado creado correctamente");
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleCreateAll = async () => {
    if (tempShipments.length === 0) {
      toast.error("No hay envíos en la lista");
      return;
    }

    let successCount = 0;
    for (const shipment of tempShipments) {
      try {
        await createShipmentMutation.mutateAsync(shipment);
        successCount++;
      } catch (error) {
        // Continue with others
      }
    }

    if (successCount > 0) {
      setTempShipments([]);
      setSelectedIds([]);
      toast.success(`${successCount} envío(s) creado(s) correctamente`);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const allDbIds = terciarizadosPendientes.map((e) => e.id);
    if (selectedIds.length === allDbIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allDbIds);
    }
  };

  const getEmpresaLabel = (empresaId: string) => {
    const empresa = empresas.find((e) => e.id === empresaId);
    return empresa?.nombre || empresaId;
  };

  return (
    <div className="space-y-6">
      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Agregar Envío Terciarizado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Company and Tracking */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Empresa Terciarizada *</Label>
              <Select
                value={formData.empresa_terciarizada}
                onValueChange={(value) => handleInputChange("empresa_terciarizada", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nombre} ({e.codigo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tracking Externo *</Label>
              <Input
                placeholder="Ej: AR123456789"
                value={formData.tracking_externo}
                onChange={(e) => handleInputChange("tracking_externo", e.target.value)}
              />
            </div>
          </div>

          {/* Client and Order codes */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código de Cliente</Label>
              <Input
                placeholder="Código de cliente externo"
                value={formData.codigo_cliente_externo}
                onChange={(e) => handleInputChange("codigo_cliente_externo", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Código de Orden</Label>
              <Input
                placeholder="Código de orden externo"
                value={formData.codigo_orden_externo}
                onChange={(e) => handleInputChange("codigo_orden_externo", e.target.value)}
              />
            </div>
          </div>

          {/* Recipient */}
          <div className="space-y-2">
            <Label>Nombre Destinatario/Cliente *</Label>
            <Input
              placeholder="Nombre completo"
              value={formData.nombre_destinatario}
              onChange={(e) => handleInputChange("nombre_destinatario", e.target.value)}
            />
          </div>

          {/* Address */}
          <AddressAutocomplete
            value={formData.direccion_entrega}
            onChange={(value) => handleInputChange("direccion_entrega", value)}
            onSelect={handleAddressSelect}
            label="Calle y Número"
            placeholder="Buscar dirección..."
            required
          />

          {/* City, Province, Postal Code */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Ciudad *</Label>
              <Input
                placeholder="Ciudad"
                value={formData.ciudad_entrega}
                onChange={(e) => handleInputChange("ciudad_entrega", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Provincia *</Label>
              <Select
                value={formData.provincia}
                onValueChange={(value) => handleInputChange("provincia", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar provincia" />
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
              <Label>Código Postal</Label>
              <Input
                placeholder="C.P."
                value={formData.cp_entrega}
                onChange={(e) => handleInputChange("cp_entrega", e.target.value)}
              />
            </div>
          </div>

          {/* Operation Type */}
          <div className="space-y-2">
            <Label>Tipo de Operación *</Label>
            <RadioGroup
              value={formData.tipo_operacion}
              onValueChange={(value) => handleInputChange("tipo_operacion", value)}
              className="flex gap-6"
            >
              {TIPO_OPERACION.map((op) => (
                <div key={op.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={op.value} id={op.value} />
                  <Label htmlFor={op.value} className="cursor-pointer">
                    {op.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Date and Duration */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Fecha
              </Label>
              <Input
                type="date"
                value={formData.fecha}
                onChange={(e) => handleInputChange("fecha", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Duración Estimada (minutos)
              </Label>
              <Input
                type="number"
                min={5}
                max={180}
                value={formData.duracion_estimada_minutos}
                onChange={(e) => handleInputChange("duracion_estimada_minutos", parseInt(e.target.value) || 30)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea
              placeholder="Instrucciones o notas adicionales"
              value={formData.notas}
              onChange={(e) => handleInputChange("notas", e.target.value)}
              rows={2}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={handleAddToList}>
              <Plus className="mr-1 h-4 w-4" />
              Agregar a Lista
            </Button>
            <Button onClick={handleCreateSingle} disabled={createShipmentMutation.isPending}>
              {createShipmentMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Crear Envío
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Temporary List */}
      {tempShipments.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Envíos Agregados ({tempShipments.length})
              </CardTitle>
              <Button onClick={handleCreateAll} disabled={createShipmentMutation.isPending}>
                {createShipmentMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                Crear Todos
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tracking Externo</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tempShipments.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-sm">{s.tracking_externo}</TableCell>
                    <TableCell>{getEmpresaLabel(s.empresa_terciarizada)}</TableCell>
                    <TableCell>{s.nombre_destinatario}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.direccion_entrega}, {s.ciudad_entrega}
                    </TableCell>
                    <TableCell className="capitalize">{s.tipo_operacion}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveFromList(s.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Existing Third-Party Shipments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-5 w-5" />
              Envíos Terciarizados Pendientes ({terciarizadosPendientes.length})
            </CardTitle>
            {terciarizadosPendientes.length > 0 && (
              <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                {selectedIds.length === terciarizadosPendientes.length ? "Deseleccionar" : "Seleccionar Todos"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : terciarizadosPendientes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay envíos terciarizados pendientes</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.length === terciarizadosPendientes.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Tracking Externo</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {terciarizadosPendientes.map((envio) => (
                  <TableRow key={envio.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(envio.id)}
                        onCheckedChange={() => toggleSelection(envio.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {envio.tracking_externo || "-"}
                    </TableCell>
                    <TableCell>
                      {getEmpresaLabel(envio.empresa_terciarizada || "")}
                    </TableCell>
                    <TableCell>{envio.nombre_destinatario || "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {envio.direccion_entrega || "-"}
                    </TableCell>
                    <TableCell>{envio.ciudad_entrega || "-"}</TableCell>
                    <TableCell className="text-sm">
                      {envio.created_at
                        ? format(new Date(envio.created_at), "dd/MM/yyyy")
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

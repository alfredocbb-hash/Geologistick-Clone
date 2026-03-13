import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DollarSign,
  Weight,
  ChevronDown,
  Layers,
  Zap,
  Users,
  Settings2,
  Package,
} from "lucide-react";
import { FormTooltip } from "./FormTooltip";
import { TarifaSandbox } from "./TarifaSandbox";
import { RateTypeSelector } from "./RateTypeSelector";
import { WeightRangesEditor } from "./WeightRangesEditor";
import type { RateType } from "./RateTypeSelector";
import type { WeightRange } from "./WeightRangesEditor";

interface ConceptoPrice {
  monto: string;
  es_porcentaje: boolean;
  porcentaje: string;
  multiplicar_por_bultos: boolean;
}

interface FormData {
  nombre: string;
  tipo_tarifa: RateType;
  precio_base: string;
  precio_por_kg: string;
  precio_por_km: string;
  precio_por_m3: string;
  zona_origen: string;
  zona_destino: string;
  comision_chofer_porcentaje: string;
  comision_chofer_fija: string;
  activa: boolean;
  peso_base_hasta: string;
  adicional_por_kg: string;
  volumen_base_hasta: string;
  adicional_por_m3: string;
  rangos_kg: WeightRange[];
  umbral_volumen_cm: number;
  multiplicar_flete_por_bultos: boolean;
  porcentaje_flete_bulto: string;
  conceptos: Record<string, ConceptoPrice>;
  express_surcharge: string;
}

interface TarifaConcepto {
  id: string;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  activo: boolean;
  orden: number;
  es_basico: boolean;
}

interface CreateTarifaWizardProps {
  formData: FormData;
  setFormData: (data: FormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  editingTarifa: any | null;
  conceptos: TarifaConcepto[];
  isPending: boolean;
}

type CalcMode = "fijo" | "peso";

export function CreateTarifaWizard({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  editingTarifa,
  conceptos,
  isPending,
}: CreateTarifaWizardProps) {
  const [showAdvanced, setShowAdvanced] = useState(
    !["peso", "codigo_postal"].includes(formData.tipo_tarifa) &&
      formData.tipo_tarifa !== "peso"
  );
  const [showExpress, setShowExpress] = useState(
    !!formData.express_surcharge && parseFloat(formData.express_surcharge) > 0
  );

  // Derive simple mode from tipo_tarifa
  const calcMode: CalcMode =
    formData.tipo_tarifa === "peso" ? "peso" : "fijo";
  const isAdvancedType = !["peso", "codigo_postal"].includes(formData.tipo_tarifa) && formData.tipo_tarifa !== "peso";

  const handleCalcModeChange = (mode: CalcMode) => {
    if (mode === "fijo") {
      setFormData({ ...formData, tipo_tarifa: "codigo_postal" as RateType });
      setShowAdvanced(false);
    } else {
      setFormData({ ...formData, tipo_tarifa: "peso" });
      setShowAdvanced(false);
    }
  };

  const activeConceptos = conceptos.filter((c) => c.activo);

  return (
    <form onSubmit={onSubmit} className="flex flex-col lg:flex-row gap-6">
      {/* Left column: Form */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Section 1: ¿Cómo quieres cobrar? */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            ¿Cómo quieres cobrar?
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleCalcModeChange("fijo")}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                calcMode === "fijo"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className={`p-2 rounded-lg inline-flex mb-2 ${calcMode === "fijo" ? "bg-primary/10" : "bg-muted"}`}>
                <DollarSign className={`h-5 w-5 ${calcMode === "fijo" ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <p className="font-medium text-sm">Precio Fijo</p>
              <p className="text-xs text-muted-foreground">
                Un monto fijo por envío
              </p>
            </button>
            <button
              type="button"
              onClick={() => handleCalcModeChange("peso")}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                calcMode === "peso"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className={`p-2 rounded-lg inline-flex mb-2 ${calcMode === "peso" ? "bg-primary/10" : "bg-muted"}`}>
                <Weight className={`h-5 w-5 ${calcMode === "peso" ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <p className="font-medium text-sm">Por Peso</p>
              <p className="text-xs text-muted-foreground">
                Base + cargo por kg adicional
              </p>
            </button>
          </div>

          {/* Advanced types collapsible */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Settings2 className="h-3 w-3" />
                Modo avanzado (distancia, zona, volumen)
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <RateTypeSelector
                value={formData.tipo_tarifa}
                onChange={(value) => setFormData({ ...formData, tipo_tarifa: value })}
              />
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Section 2: Nombre + Precio Base */}
        <div className="space-y-4">
          <div className="space-y-2">
            <FormTooltip
              label="Nombre de la Tarifa"
              tooltip="Nombre descriptivo, ej: Envío Local Buenos Aires"
              required
              htmlFor="nombre"
            />
            <Input
              id="nombre"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Ej: Envío Local, Express CABA, etc."
              required
            />
          </div>
          <div className="space-y-2">
            <FormTooltip
              label="Precio Base"
              tooltip="Monto mínimo por envío. Se aplica siempre como piso del cálculo"
              required
              htmlFor="precio_base"
            />
            <Input
              id="precio_base"
              type="number"
              step="0.01"
              value={formData.precio_base}
              onChange={(e) => setFormData({ ...formData, precio_base: e.target.value })}
              placeholder="5000"
              required
            />
          </div>
        </div>

        {/* Weight-specific fields */}
        {formData.tipo_tarifa === "peso" && (
          <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Weight className="h-4 w-4" />
              Configuración por Peso
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <FormTooltip
                  label="Peso incluido en base (Kg)"
                  tooltip="Kilogramos cubiertos por el precio base sin cargo adicional"
                  htmlFor="peso_base_hasta"
                />
                <Input
                  id="peso_base_hasta"
                  type="number"
                  step="0.1"
                  value={formData.peso_base_hasta}
                  onChange={(e) => setFormData({ ...formData, peso_base_hasta: e.target.value })}
                  placeholder="5"
                />
              </div>
              <div className="space-y-2">
                <FormTooltip
                  label="Precio por Kg adicional"
                  tooltip="Cargo extra por cada kg que exceda el peso base"
                  htmlFor="adicional_por_kg"
                />
                <Input
                  id="adicional_por_kg"
                  type="number"
                  step="0.01"
                  value={formData.adicional_por_kg}
                  onChange={(e) => setFormData({ ...formData, adicional_por_kg: e.target.value })}
                  placeholder="150"
                />
              </div>
            </div>

            {/* Weight Ranges Editor */}
            <WeightRangesEditor
              ranges={formData.rangos_kg}
              onChange={(ranges) => setFormData({ ...formData, rangos_kg: ranges })}
              umbralVolumen={formData.umbral_volumen_cm}
              onUmbralChange={(umbral) => setFormData({ ...formData, umbral_volumen_cm: umbral })}
              precioPorM3={parseFloat(formData.precio_por_m3) || 0}
              onPrecioM3Change={(precio) => setFormData({ ...formData, precio_por_m3: precio.toString() })}
              showVolumeSettings={true}
            />
          </div>
        )}

        {/* Distance fields */}
        {formData.tipo_tarifa === "distancia" && (
          <div className="space-y-2 p-4 rounded-lg bg-muted/50 border">
            <FormTooltip
              label="Precio por Kilómetro"
              tooltip="Cargo por cada km de distancia entre origen y destino"
              htmlFor="precio_por_km"
            />
            <Input
              id="precio_por_km"
              type="number"
              step="0.01"
              value={formData.precio_por_km}
              onChange={(e) => setFormData({ ...formData, precio_por_km: e.target.value })}
              placeholder="50"
            />
          </div>
        )}

        {/* Volume fields */}
        {formData.tipo_tarifa === "volumen" && (
          <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <FormTooltip label="Volumen incluido en base (m³)" tooltip="Metros cúbicos cubiertos por el precio base" htmlFor="volumen_base_hasta" />
                <Input id="volumen_base_hasta" type="number" step="0.01" value={formData.volumen_base_hasta} onChange={(e) => setFormData({ ...formData, volumen_base_hasta: e.target.value })} placeholder="0.5" />
              </div>
              <div className="space-y-2">
                <FormTooltip label="Precio por m³ adicional" tooltip="Cargo por metro cúbico que exceda la base" htmlFor="adicional_por_m3" />
                <Input id="adicional_por_m3" type="number" step="0.01" value={formData.adicional_por_m3} onChange={(e) => setFormData({ ...formData, adicional_por_m3: e.target.value })} placeholder="500" />
              </div>
            </div>
          </div>
        )}

        {/* Zone / CP fields */}
        {(formData.tipo_tarifa === "zona" || formData.tipo_tarifa === "codigo_postal") && (
          <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <FormTooltip label={formData.tipo_tarifa === "zona" ? "Zona Origen" : "CP Origen"} tooltip="Ciudad o zona que define la ruta de esta tarifa" htmlFor="zona_origen" />
                <Input id="zona_origen" value={formData.zona_origen} onChange={(e) => setFormData({ ...formData, zona_origen: e.target.value })} placeholder={formData.tipo_tarifa === "zona" ? "Capital" : "1000"} />
              </div>
              <div className="space-y-2">
                <FormTooltip label={formData.tipo_tarifa === "zona" ? "Zona Destino" : "CP Destino"} tooltip="Ciudad o zona de destino" htmlFor="zona_destino" />
                <Input id="zona_destino" value={formData.zona_destino} onChange={(e) => setFormData({ ...formData, zona_destino: e.target.value })} placeholder={formData.tipo_tarifa === "zona" ? "GBA" : "1900"} />
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Toggle multiplicador */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
          <div className="space-y-0.5">
            <FormTooltip
              label="Multiplicar flete por bultos"
              tooltip="Si está activo, el precio base se cobra por cada unidad/bulto del envío"
            />
            <p className="text-xs text-muted-foreground pl-0.5">
              El precio base se cobra por cada paquete
            </p>
          </div>
           <Switch
            checked={formData.multiplicar_flete_por_bultos}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, multiplicar_flete_por_bultos: checked, porcentaje_flete_bulto: '0' })
            }
          />
        </div>

        {/* Porcentaje por bulto extra (cuando NO multiplica) */}
        {!formData.multiplicar_flete_por_bultos && (
          <div className="space-y-1 pl-1">
            <FormTooltip
              label="Porcentaje por bulto extra (%)"
              tooltip="Si hay más de 1 bulto, se cobra este porcentaje del flete por cada bulto adicional. Ej: 50% con 3 bultos = flete + 50% × 2"
            />
            <Input
              type="number"
              min={0}
              max={100}
              step={1}
              value={formData.porcentaje_flete_bulto}
              onChange={(e) => setFormData({ ...formData, porcentaje_flete_bulto: e.target.value })}
              placeholder="0"
              className="h-8 text-sm w-32"
            />
            <p className="text-xs text-muted-foreground">
              0 = sin recargo por bultos extra
            </p>
          </div>
        )}

        {/* Section 4: Cargos Adicionales (Conceptos) */}
        {activeConceptos.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <FormTooltip
                label="Cargos Adicionales"
                tooltip="Estos cargos se suman al flete base. Los básicos se cobran siempre"
              />
            </div>
            <div className="space-y-2">
              {activeConceptos.map((concepto) => {
                const isSeguro = concepto.codigo?.toLowerCase().includes("seguro");
                const currentValue = formData.conceptos[concepto.id] || {
                  monto: "",
                  es_porcentaje: isSeguro,
                  porcentaje: "",
                  multiplicar_por_bultos: false,
                };

                return (
                  <div
                    key={concepto.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {concepto.nombre}
                        </span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {concepto.es_basico ? "Básico" : "Adicional"}
                        </Badge>
                      </div>
                    </div>

                    {isSeguro ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Switch
                            id={`pct-${concepto.id}`}
                            checked={currentValue.es_porcentaje}
                            onCheckedChange={(checked) =>
                              setFormData({
                                ...formData,
                                conceptos: {
                                  ...formData.conceptos,
                                  [concepto.id]: { ...currentValue, es_porcentaje: checked },
                                },
                              })
                            }
                          />
                          <Label htmlFor={`pct-${concepto.id}`} className="text-xs">
                            {currentValue.es_porcentaje ? "%" : "$"}
                          </Label>
                        </div>
                        {currentValue.es_porcentaje ? (
                          <div className="w-24">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="2.5"
                              value={currentValue.porcentaje}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  conceptos: {
                                    ...formData.conceptos,
                                    [concepto.id]: { ...currentValue, porcentaje: e.target.value },
                                  },
                                })
                              }
                              className="text-right"
                            />
                          </div>
                        ) : (
                          <div className="w-28">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={currentValue.monto}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  conceptos: {
                                    ...formData.conceptos,
                                    [concepto.id]: { ...currentValue, monto: e.target.value },
                                  },
                                })
                              }
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-28">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={currentValue.monto}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              conceptos: {
                                ...formData.conceptos,
                                [concepto.id]: {
                                  ...currentValue,
                                  monto: e.target.value,
                                  es_porcentaje: false,
                                },
                              },
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 5: Express (colapsable) */}
        <Collapsible open={showExpress} onOpenChange={setShowExpress}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Zap className="h-3.5 w-3.5" />
              Recargo Express
              <ChevronDown
                className={`h-3 w-3 transition-transform ${showExpress ? "rotate-180" : ""}`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="p-4 rounded-lg bg-muted/30 border space-y-2">
              <FormTooltip
                label="Recargo Express"
                tooltip="Este monto se agrega al precio final cuando el envío es express"
                htmlFor="express_surcharge"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">+</span>
                <Input
                  id="express_surcharge"
                  type="number"
                  step="0.01"
                  value={formData.express_surcharge || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, express_surcharge: e.target.value })
                  }
                  placeholder="0.00"
                  className="max-w-[180px]"
                />
                <span className="text-xs text-muted-foreground">sobre tarifa base</span>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Section 6: Comisión Chofer + Switch Activa */}
        <div className="border-t pt-4 space-y-4">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Comisión Chofer
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <FormTooltip
                label="Porcentaje %"
                tooltip="Porcentaje del total que se asigna al chofer"
                htmlFor="comision_chofer_porcentaje"
              />
              <Input
                id="comision_chofer_porcentaje"
                type="number"
                step="0.01"
                value={formData.comision_chofer_porcentaje}
                onChange={(e) =>
                  setFormData({ ...formData, comision_chofer_porcentaje: e.target.value })
                }
                placeholder="10"
              />
            </div>
            <div className="space-y-2">
              <FormTooltip
                label="Monto Fijo"
                tooltip="Monto fijo por envío para el chofer"
                htmlFor="comision_chofer_fija"
              />
              <Input
                id="comision_chofer_fija"
                type="number"
                step="0.01"
                value={formData.comision_chofer_fija}
                onChange={(e) =>
                  setFormData({ ...formData, comision_chofer_fija: e.target.value })
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="activa">Tarifa Activa</Label>
            <Switch
              id="activa"
              checked={formData.activa}
              onCheckedChange={(checked) => setFormData({ ...formData, activa: checked })}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending} className="bg-tarifas hover:bg-tarifas/90">
            {isPending ? "Guardando..." : editingTarifa ? "Actualizar" : "Crear Tarifa"}
          </Button>
        </div>
      </div>

      {/* Right column: Sandbox */}
      <div className="w-full lg:w-72 shrink-0">
        <TarifaSandbox formData={formData} conceptos={conceptos} />
      </div>
    </form>
  );
}

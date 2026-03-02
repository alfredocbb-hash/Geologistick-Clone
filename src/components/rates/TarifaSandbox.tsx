import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, Package, Weight } from "lucide-react";
import { FormTooltip } from "./FormTooltip";

interface ConceptoPrice {
  monto: string;
  es_porcentaje: boolean;
  porcentaje: string;
  multiplicar_por_bultos: boolean;
}

interface TarifaSandboxProps {
  formData: {
    tipo_tarifa: string;
    precio_base: string;
    multiplicar_flete_por_bultos: boolean;
    peso_base_hasta: string;
    adicional_por_kg: string;
    precio_por_km: string;
    volumen_base_hasta: string;
    adicional_por_m3: string;
    express_surcharge?: string;
    conceptos: Record<string, ConceptoPrice>;
  };
  conceptos: Array<{ id: string; nombre: string; codigo: string; activo: boolean; es_basico: boolean }>;
}

interface DesgloseItem {
  label: string;
  detail?: string;
  amount: number;
}

function simulateRate(
  formData: TarifaSandboxProps["formData"],
  pesoEjemplo: number,
  cantidadBultos: number,
  valorDeclarado: number,
  conceptos: TarifaSandboxProps["conceptos"]
): { desglose: DesgloseItem[]; total: number } {
  const desglose: DesgloseItem[] = [];
  let precioBase = parseFloat(formData.precio_base) || 0;

  // Flete base
  desglose.push({ label: "Flete base", amount: precioBase });

  // Multiplicar por bultos
  if (formData.multiplicar_flete_por_bultos && cantidadBultos > 1) {
    const subtotal = precioBase * cantidadBultos;
    desglose.push({
      label: `× ${cantidadBultos} bultos`,
      detail: `$${precioBase.toLocaleString("es-AR")} × ${cantidadBultos}`,
      amount: subtotal - precioBase,
    });
    precioBase = subtotal;
  }

  let total = precioBase;

  // Excedente por peso
  if (formData.tipo_tarifa === "peso") {
    const pesoBase = parseFloat(formData.peso_base_hasta) || 0;
    const adicional = parseFloat(formData.adicional_por_kg) || 0;
    if (pesoEjemplo > pesoBase && adicional > 0) {
      const excedente = (pesoEjemplo - pesoBase) * adicional;
      desglose.push({
        label: "Excedente peso",
        detail: `(${pesoEjemplo}kg - ${pesoBase}kg) × $${adicional.toLocaleString("es-AR")}/kg`,
        amount: excedente,
      });
      total += excedente;
    }
  }

  // Excedente por distancia
  if (formData.tipo_tarifa === "distancia") {
    const precioPorKm = parseFloat(formData.precio_por_km) || 0;
    if (precioPorKm > 0) {
      const distanciaEjemplo = 20; // ejemplo fijo
      const cargo = precioPorKm * distanciaEjemplo;
      desglose.push({
        label: "Distancia (ej. 20km)",
        detail: `${distanciaEjemplo}km × $${precioPorKm.toLocaleString("es-AR")}/km`,
        amount: cargo,
      });
      total += cargo;
    }
  }

  // Conceptos
  const activeConceptos = conceptos.filter((c) => c.activo);
  activeConceptos.forEach((concepto) => {
    const config = formData.conceptos[concepto.id];
    if (!config) return;

    if (config.es_porcentaje) {
      const pct = parseFloat(config.porcentaje) || 0;
      if (pct > 0 && valorDeclarado > 0) {
        const monto = (valorDeclarado * pct) / 100;
        desglose.push({
          label: concepto.nombre,
          detail: `${pct}% de $${valorDeclarado.toLocaleString("es-AR")}`,
          amount: monto,
        });
        total += monto;
      }
    } else {
      const monto = parseFloat(config.monto) || 0;
      if (monto > 0) {
        desglose.push({ label: concepto.nombre, amount: monto });
        total += monto;
      }
    }
  });

  // Express surcharge
  const expressSurcharge = parseFloat(formData.express_surcharge || "0") || 0;
  if (expressSurcharge > 0) {
    desglose.push({
      label: "Recargo Express",
      detail: "+ sobre tarifa base",
      amount: expressSurcharge,
    });
    total += expressSurcharge;
  }

  return { desglose, total };
}

const formatARS = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

export function TarifaSandbox({ formData, conceptos }: TarifaSandboxProps) {
  const [pesoEjemplo, setPesoEjemplo] = useState(10);
  const [cantidadBultos, setCantidadBultos] = useState(1);
  const [valorDeclarado, setValorDeclarado] = useState(10000);

  const { desglose, total } = useMemo(
    () => simulateRate(formData, pesoEjemplo, cantidadBultos, valorDeclarado, conceptos),
    [formData, pesoEjemplo, cantidadBultos, valorDeclarado, conceptos]
  );

  const hasSeguro = conceptos.some(
    (c) => c.codigo?.toLowerCase() === "seguro" && formData.conceptos[c.id]?.es_porcentaje
  );

  return (
    <Card className="border-dashed sticky top-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          Calculadora de Prueba
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Weight className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium">Peso (kg)</span>
            </div>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={pesoEjemplo}
              onChange={(e) => setPesoEjemplo(parseFloat(e.target.value) || 0)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Package className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium">Bultos</span>
            </div>
            <Input
              type="number"
              min={1}
              value={cantidadBultos}
              onChange={(e) => setCantidadBultos(parseInt(e.target.value) || 1)}
              className="h-8 text-sm"
            />
          </div>
        </div>

        {hasSeguro && (
          <div className="space-y-1">
            <span className="text-xs font-medium">Valor declarado ($)</span>
            <Input
              type="number"
              min={0}
              value={valorDeclarado}
              onChange={(e) => setValorDeclarado(parseFloat(e.target.value) || 0)}
              className="h-8 text-sm"
            />
          </div>
        )}

        {/* Desglose */}
        <div className="border-t pt-3 space-y-2">
          {desglose.map((item, i) => (
            <div key={i} className="flex justify-between items-start text-sm">
              <div className="flex-1 min-w-0">
                <span className={i === 0 ? "font-medium" : "text-muted-foreground"}>
                  {item.label}
                </span>
                {item.detail && (
                  <p className="text-[10px] text-muted-foreground leading-tight">{item.detail}</p>
                )}
              </div>
              <span className={`font-mono text-xs tabular-nums ${i === 0 ? "" : "text-muted-foreground"}`}>
                {i === 0 ? formatARS(item.amount) : `+ ${formatARS(item.amount)}`}
              </span>
            </div>
          ))}

          <div className="border-t pt-2 flex justify-between items-center">
            <span className="font-semibold text-sm">Total estimado</span>
            <span className="font-bold text-base text-primary font-mono tabular-nums">
              {formatARS(total)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, Package, Weight, Ruler } from "lucide-react";

interface ConceptoPrice {
  monto: string;
  es_porcentaje: boolean;
  porcentaje: string;
  multiplicar_por_bultos: boolean;
}

interface WeightRange {
  desde: number;
  hasta: number;
  precio: number;
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
    express_surcharge: string;
    rangos_kg: WeightRange[];
    umbral_volumen_cm: number;
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
  dimensiones: { largo: number; ancho: number; alto: number },
  conceptos: TarifaSandboxProps["conceptos"]
): { desglose: DesgloseItem[]; total: number; metodo: string } {
  const desglose: DesgloseItem[] = [];
  const precioBase = parseFloat(formData.precio_base) || 0;
  let flete = precioBase;
  let metodo = "";

  // STEP 1: Check volume override (dimensions exceed threshold)
  if (formData.tipo_tarifa === "peso" && formData.umbral_volumen_cm > 0) {
    const dims = [dimensiones.largo, dimensiones.ancho, dimensiones.alto].filter(d => d > 0);
    const exceedsThreshold = dims.some(d => d > formData.umbral_volumen_cm);
    if (exceedsThreshold && dims.length === 3) {
      const volumenM3 = dims.reduce((a, b) => a * b, 1) / 1000000;
      const adicionalM3 = parseFloat(formData.adicional_por_m3) || 0;
      flete = precioBase + (volumenM3 * adicionalM3);
      metodo = "volumen_excedido";
      desglose.push({
        label: "Flete (volumen excedido)",
        detail: `Dimensión > ${formData.umbral_volumen_cm}cm → ${volumenM3.toFixed(4)} m³`,
        amount: flete,
      });
    }
  }

  // STEP 2: Rate type calculation (if volume didn't apply)
  if (!metodo) {
    if (formData.tipo_tarifa === "peso") {
      const rangosKg = formData.rangos_kg || [];

      // PRIORITY 1: Stepped weight ranges (rangos_kg)
      if (rangosKg.length > 0 && pesoEjemplo > 0) {
        const rangoAplicable = rangosKg.find(
          (r) => pesoEjemplo >= r.desde && pesoEjemplo <= r.hasta
        );
        if (rangoAplicable) {
          flete = rangoAplicable.precio;
          metodo = "rangos_kg";
          desglose.push({
            label: "Flete (rango de peso)",
            detail: `${rangoAplicable.desde}-${rangoAplicable.hasta} kg → precio del rango`,
            amount: flete,
          });
        } else {
          // Weight exceeds all ranges → use last range
          const ultimoRango = rangosKg[rangosKg.length - 1];
          if (ultimoRango && pesoEjemplo > ultimoRango.hasta) {
            flete = ultimoRango.precio;
            metodo = "rangos_kg_excedido";
            desglose.push({
              label: "Flete (peso excedido)",
              detail: `${pesoEjemplo}kg > máx ${ultimoRango.hasta}kg → último rango`,
              amount: flete,
            });
          }
        }
      }

      // PRIORITY 2: Simple method (base + additional per kg)
      if (!metodo) {
        const pesoBase = parseFloat(formData.peso_base_hasta) || 0;
        const adicional = parseFloat(formData.adicional_por_kg) || 0;
        if (pesoEjemplo > pesoBase && adicional > 0) {
          const kgExtra = pesoEjemplo - pesoBase;
          flete = precioBase + kgExtra * adicional;
          metodo = "peso_simple";
          desglose.push({ label: "Flete base", amount: precioBase });
          desglose.push({
            label: "Excedente peso",
            detail: `(${pesoEjemplo}kg - ${pesoBase}kg) × $${adicional.toLocaleString("es-AR")}/kg`,
            amount: kgExtra * adicional,
          });
        } else {
          metodo = "base";
          desglose.push({ label: "Flete base", amount: precioBase });
        }
      }
    } else if (formData.tipo_tarifa === "distancia") {
      const precioPorKm = parseFloat(formData.precio_por_km) || 0;
      if (precioPorKm > 0) {
        const distanciaEjemplo = 20;
        flete = precioPorKm * distanciaEjemplo;
        metodo = "distancia";
        desglose.push({
          label: "Flete (distancia ej. 20km)",
          detail: `${distanciaEjemplo}km × $${precioPorKm.toLocaleString("es-AR")}/km`,
          amount: flete,
        });
      } else {
        metodo = "base";
        desglose.push({ label: "Flete base", amount: precioBase });
      }
    } else if (formData.tipo_tarifa === "volumen") {
      const volBaseHasta = parseFloat(formData.volumen_base_hasta) || 0;
      const adicionalM3 = parseFloat(formData.adicional_por_m3) || 0;
      const dims = [dimensiones.largo, dimensiones.ancho, dimensiones.alto].filter(d => d > 0);
      if (dims.length === 3) {
        const volM3 = dims.reduce((a, b) => a * b, 1) / 1000000;
        if (volM3 > volBaseHasta && adicionalM3 > 0) {
          flete = precioBase + (volM3 - volBaseHasta) * adicionalM3;
          metodo = "volumen";
          desglose.push({ label: "Flete base", amount: precioBase });
          desglose.push({
            label: "Excedente volumen",
            detail: `(${volM3.toFixed(4)} - ${volBaseHasta}) m³ × $${adicionalM3.toLocaleString("es-AR")}`,
            amount: (volM3 - volBaseHasta) * adicionalM3,
          });
        } else {
          metodo = "base";
          desglose.push({ label: "Flete base", amount: precioBase });
        }
      } else {
        metodo = "base";
        desglose.push({ label: "Flete base", amount: precioBase });
      }
    } else {
      // fijo, zona, codigo_postal, etc.
      metodo = "base";
      desglose.push({ label: "Flete base", amount: precioBase });
    }
  }

  // STEP 3: Multiply by packages
  if (formData.multiplicar_flete_por_bultos && cantidadBultos > 1) {
    const fleteOriginal = flete;
    flete = flete * cantidadBultos;
    desglose.push({
      label: `× ${cantidadBultos} bultos`,
      detail: `$${fleteOriginal.toLocaleString("es-AR")} × ${cantidadBultos}`,
      amount: flete - fleteOriginal,
    });
  }

  let total = flete;

  // STEP 4: Concepts
  const activeConceptos = conceptos.filter((c) => c.activo);
  activeConceptos.forEach((concepto) => {
    const config = formData.conceptos[concepto.id];
    if (!config) return;

    // Skip flete concepts (already calculated above)
    if (concepto.codigo?.toLowerCase().includes("flete")) return;

    if (config.es_porcentaje) {
      const pct = parseFloat(config.porcentaje) || 0;
      if (pct > 0 && valorDeclarado > 0) {
        let monto = (valorDeclarado * pct) / 100;
        if (config.multiplicar_por_bultos && cantidadBultos > 1) {
          monto *= cantidadBultos;
        }
        desglose.push({
          label: concepto.nombre,
          detail: `${pct}% de $${valorDeclarado.toLocaleString("es-AR")}${config.multiplicar_por_bultos && cantidadBultos > 1 ? ` × ${cantidadBultos}` : ""}`,
          amount: monto,
        });
        total += monto;
      }
    } else {
      let monto = parseFloat(config.monto) || 0;
      if (monto > 0) {
        if (config.multiplicar_por_bultos && cantidadBultos > 1) {
          monto *= cantidadBultos;
        }
        desglose.push({
          label: concepto.nombre,
          detail: config.multiplicar_por_bultos && cantidadBultos > 1 ? `× ${cantidadBultos} bultos` : undefined,
          amount: monto,
        });
        total += monto;
      }
    }
  });

  // STEP 5: Express surcharge
  const expressSurcharge = parseFloat(formData.express_surcharge || "0") || 0;
  if (expressSurcharge > 0) {
    desglose.push({
      label: "Recargo Express",
      detail: "+ sobre tarifa base",
      amount: expressSurcharge,
    });
    total += expressSurcharge;
  }

  return { desglose, total, metodo };
}

const formatARS = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

export function TarifaSandbox({ formData, conceptos }: TarifaSandboxProps) {
  const [pesoEjemplo, setPesoEjemplo] = useState(10);
  const [cantidadBultos, setCantidadBultos] = useState(1);
  const [valorDeclarado, setValorDeclarado] = useState(10000);
  const [dimensiones, setDimensiones] = useState({ largo: 0, ancho: 0, alto: 0 });

  const { desglose, total, metodo } = useMemo(
    () => simulateRate(formData, pesoEjemplo, cantidadBultos, valorDeclarado, dimensiones, conceptos),
    [formData, pesoEjemplo, cantidadBultos, valorDeclarado, dimensiones, conceptos]
  );

  const hasSeguro = conceptos.some(
    (c) => c.codigo?.toLowerCase().includes("seguro") && formData.conceptos[c.id]?.es_porcentaje
  );

  const showDimensiones = formData.tipo_tarifa === "peso" || formData.tipo_tarifa === "volumen";

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

        {showDimensiones && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Ruler className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium">Dimensiones (cm) - opcional</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number"
                min={0}
                placeholder="Largo"
                value={dimensiones.largo || ""}
                onChange={(e) => setDimensiones({ ...dimensiones, largo: parseFloat(e.target.value) || 0 })}
                className="h-8 text-sm"
              />
              <Input
                type="number"
                min={0}
                placeholder="Ancho"
                value={dimensiones.ancho || ""}
                onChange={(e) => setDimensiones({ ...dimensiones, ancho: parseFloat(e.target.value) || 0 })}
                className="h-8 text-sm"
              />
              <Input
                type="number"
                min={0}
                placeholder="Alto"
                value={dimensiones.alto || ""}
                onChange={(e) => setDimensiones({ ...dimensiones, alto: parseFloat(e.target.value) || 0 })}
                className="h-8 text-sm"
              />
            </div>
          </div>
        )}

        {/* Desglose */}
        <div className="border-t pt-3 space-y-2">
          {metodo && (
            <p className="text-[10px] text-muted-foreground italic mb-1">
              Método: {metodo === "rangos_kg" ? "Rangos de peso" : metodo === "peso_simple" ? "Base + adicional/kg" : metodo === "volumen_excedido" ? "Volumen (dimensión excedida)" : metodo === "distancia" ? "Por distancia" : metodo === "volumen" ? "Por volumen" : "Precio base"}
            </p>
          )}
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

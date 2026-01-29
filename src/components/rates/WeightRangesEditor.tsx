import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Scale, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface WeightRange {
  desde: number;
  hasta: number;
  precio: number;
}

interface WeightRangesEditorProps {
  ranges: WeightRange[];
  onChange: (ranges: WeightRange[]) => void;
  umbralVolumen?: number;
  onUmbralChange?: (umbral: number) => void;
  precioPorM3?: number;
  onPrecioM3Change?: (precio: number) => void;
  showVolumeSettings?: boolean;
}

export function WeightRangesEditor({
  ranges,
  onChange,
  umbralVolumen = 50,
  onUmbralChange,
  precioPorM3 = 0,
  onPrecioM3Change,
  showVolumeSettings = true,
}: WeightRangesEditorProps) {
  const [localRanges, setLocalRanges] = useState<WeightRange[]>(ranges);
  const [localUmbral, setLocalUmbral] = useState(umbralVolumen);
  const [localPrecioM3, setLocalPrecioM3] = useState(precioPorM3);

  useEffect(() => {
    setLocalRanges(ranges);
  }, [ranges]);

  useEffect(() => {
    setLocalUmbral(umbralVolumen);
  }, [umbralVolumen]);

  useEffect(() => {
    setLocalPrecioM3(precioPorM3);
  }, [precioPorM3]);

  const handleAddRange = () => {
    const lastRange = localRanges[localRanges.length - 1];
    const newFrom = lastRange ? lastRange.hasta + 0.1 : 0;
    const newTo = lastRange ? lastRange.hasta + 5 : 5;
    const newPrice = lastRange ? Math.round(lastRange.precio * 1.2) : 10000;

    const newRanges = [...localRanges, { desde: newFrom, hasta: newTo, precio: newPrice }];
    setLocalRanges(newRanges);
    onChange(newRanges);
  };

  const handleRemoveRange = (index: number) => {
    const newRanges = localRanges.filter((_, i) => i !== index);
    setLocalRanges(newRanges);
    onChange(newRanges);
  };

  const handleRangeChange = (index: number, field: keyof WeightRange, value: string) => {
    const numValue = parseFloat(value) || 0;
    const newRanges = localRanges.map((range, i) => {
      if (i === index) {
        return { ...range, [field]: numValue };
      }
      return range;
    });
    setLocalRanges(newRanges);
    onChange(newRanges);
  };

  const handleUmbralChange = (value: string) => {
    const numValue = parseInt(value) || 50;
    setLocalUmbral(numValue);
    onUmbralChange?.(numValue);
  };

  const handlePrecioM3Change = (value: string) => {
    const numValue = parseFloat(value) || 0;
    setLocalPrecioM3(numValue);
    onPrecioM3Change?.(numValue);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Validate ranges for gaps or overlaps
  const validateRanges = () => {
    const issues: string[] = [];
    for (let i = 0; i < localRanges.length; i++) {
      const range = localRanges[i];
      if (range.desde >= range.hasta) {
        issues.push(`Rango ${i + 1}: "Desde" debe ser menor que "Hasta"`);
      }
      if (i > 0) {
        const prevRange = localRanges[i - 1];
        if (range.desde <= prevRange.hasta) {
          issues.push(`Rango ${i + 1} se superpone con el anterior`);
        } else if (range.desde > prevRange.hasta + 0.1) {
          issues.push(`Hay un hueco entre el rango ${i} y ${i + 1}`);
        }
      }
    }
    return issues;
  };

  const issues = validateRanges();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          <Label className="text-base font-semibold">Rangos de Precio por Kilaje</Label>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleAddRange}>
          <Plus className="h-4 w-4 mr-1" />
          Agregar Rango
        </Button>
      </div>

      {localRanges.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <Scale className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No hay rangos definidos</p>
          <p className="text-sm text-muted-foreground">
            Usa el botón "Agregar Rango" para crear rangos de peso escalonados
          </p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Desde (kg)</TableHead>
                  <TableHead className="w-[120px]">Hasta (kg)</TableHead>
                  <TableHead className="w-[150px]">Precio</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {localRanges.map((range, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.1"
                        value={range.desde}
                        onChange={(e) => handleRangeChange(index, 'desde', e.target.value)}
                        className="w-full"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.1"
                        value={range.hasta}
                        onChange={(e) => handleRangeChange(index, 'hasta', e.target.value)}
                        className="w-full"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="100"
                        value={range.precio}
                        onChange={(e) => handleRangeChange(index, 'precio', e.target.value)}
                        className="w-full"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveRange(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            {localRanges.map((range, index) => (
              <span key={index} className="px-2 py-1 bg-muted rounded">
                {range.desde}-{range.hasta} kg: {formatCurrency(range.precio)}
              </span>
            ))}
          </div>
        </>
      )}

      {issues.length > 0 && (
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside">
              {issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {showVolumeSettings && (
        <div className="border-t pt-4 mt-4 space-y-4">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Info className="h-4 w-4" />
            Configuración de Cobro por Volumen
          </Label>
          <p className="text-xs text-muted-foreground">
            Si alguna dimensión del paquete supera el umbral, se cobra por volumen en lugar de peso.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="umbral_volumen">Umbral para volumen (cm)</Label>
              <Input
                id="umbral_volumen"
                type="number"
                value={localUmbral}
                onChange={(e) => handleUmbralChange(e.target.value)}
                placeholder="50"
              />
              <p className="text-xs text-muted-foreground">
                Si alto, ancho o largo {`>`} {localUmbral} cm → cobrar por m³
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="precio_m3">Precio por m³</Label>
              <Input
                id="precio_m3"
                type="number"
                step="100"
                value={localPrecioM3}
                onChange={(e) => handlePrecioM3Change(e.target.value)}
                placeholder="50000"
              />
              <p className="text-xs text-muted-foreground">
                Precio base + (volumen × este valor)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

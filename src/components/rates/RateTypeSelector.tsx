import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MapPin, Weight, Ruler, Package, Box } from "lucide-react";

export type RateType = 'codigo_postal' | 'zona' | 'distancia' | 'peso' | 'volumen';

interface RateTypeSelectorProps {
  value: RateType;
  onChange: (value: RateType) => void;
}

const rateTypes = [
  { 
    value: 'peso' as RateType, 
    label: 'Por Peso (Kg)', 
    description: 'Precio según peso del envío',
    icon: Weight 
  },
  { 
    value: 'distancia' as RateType, 
    label: 'Por Distancia (Km)', 
    description: 'Precio según kilómetros recorridos',
    icon: Ruler 
  },
  { 
    value: 'zona' as RateType, 
    label: 'Por Zona', 
    description: 'Precio según zona origen/destino',
    icon: MapPin 
  },
  { 
    value: 'codigo_postal' as RateType, 
    label: 'Por Código Postal', 
    description: 'Precio según CP origen/destino',
    icon: Package 
  },
  { 
    value: 'volumen' as RateType, 
    label: 'Por Volumen (m³)', 
    description: 'Precio según metros cúbicos',
    icon: Box 
  },
];

export function RateTypeSelector({ value, onChange }: RateTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Tipo de Tarifa *</Label>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        {rateTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = value === type.value;
          return (
            <div key={type.value}>
              <RadioGroupItem
                value={type.value}
                id={`rate-type-${type.value}`}
                className="peer sr-only"
              />
              <Label
                htmlFor={`rate-type-${type.value}`}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{type.label}</p>
                  <p className="text-xs text-muted-foreground">{type.description}</p>
                </div>
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
}

export function getRateTypeLabel(type: RateType): string {
  return rateTypes.find(t => t.value === type)?.label || type;
}

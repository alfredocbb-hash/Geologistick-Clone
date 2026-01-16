import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ColumnMapping } from "@/lib/csvParser";

interface FieldConfig {
  key: keyof ColumnMapping;
  label: string;
  required: boolean;
}

const REQUIRED_FIELDS: FieldConfig[] = [
  { key: "recipientName", label: "Destinatario", required: true },
  { key: "recipientAddress", label: "Dirección de Entrega", required: true },
];

const OPTIONAL_FIELDS: FieldConfig[] = [
  { key: "trackingNumber", label: "Tracking / Nº Pedido", required: false },
  { key: "orderNumber", label: "Nº Orden Alternativo", required: false },
  { key: "recipientCity", label: "Ciudad", required: false },
  { key: "recipientPhone", label: "Teléfono / WhatsApp", required: false },
  { key: "recipientLat", label: "Latitud", required: false },
  { key: "recipientLng", label: "Longitud", required: false },
  { key: "totalPrice", label: "Precio Total", required: false },
  { key: "senderName", label: "Remitente", required: false },
  { key: "senderEmail", label: "Email Remitente", required: false },
  { key: "notes", label: "Observaciones", required: false },
];

interface ColumnMapperProps {
  headers: string[];
  rows: Record<string, string>[];
  mapping: Partial<ColumnMapping>;
  onMappingChange: (mapping: Partial<ColumnMapping>) => void;
}

export default function ColumnMapper({
  headers,
  rows,
  mapping,
  onMappingChange,
}: ColumnMapperProps) {
  // Get sample value for a column
  const getSampleValue = (column: string | undefined): string => {
    if (!column || rows.length === 0) return "-";
    const value = rows[0][column];
    if (!value) return "-";
    return value.length > 30 ? value.slice(0, 30) + "..." : value;
  };

  // Get used columns to disable them in other selects
  const usedColumns = useMemo(() => {
    return new Set(Object.values(mapping).filter(Boolean) as string[]);
  }, [mapping]);

  const handleFieldChange = (fieldKey: keyof ColumnMapping, value: string) => {
    const newMapping = { ...mapping };
    if (value === "__none__") {
      delete newMapping[fieldKey];
    } else {
      newMapping[fieldKey] = value;
    }
    onMappingChange(newMapping);
  };

  const renderFieldRow = (field: FieldConfig) => {
    const currentValue = mapping[field.key];
    const sampleValue = getSampleValue(currentValue);

    return (
      <div
        key={field.key}
        className="grid grid-cols-[200px_1fr_1fr] gap-4 items-center py-2 border-b border-border/50 last:border-0"
      >
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
        </div>
        <Select
          value={currentValue || "__none__"}
          onValueChange={(value) => handleFieldChange(field.key, value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleccionar columna..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">
              <span className="text-muted-foreground">No mapear</span>
            </SelectItem>
            {headers.map((header) => {
              const isUsed = usedColumns.has(header) && mapping[field.key] !== header;
              return (
                <SelectItem
                  key={header}
                  value={header}
                  disabled={isUsed}
                  className={isUsed ? "opacity-50" : ""}
                >
                  {header}
                  {isUsed && " (en uso)"}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground truncate" title={sampleValue}>
          {currentValue ? (
            <span className="font-mono bg-muted px-2 py-1 rounded text-xs">
              {sampleValue}
            </span>
          ) : (
            <span className="text-muted-foreground/50 italic">Sin mapear</span>
          )}
        </div>
      </div>
    );
  };

  // Check if required fields are mapped
  const missingRequired = REQUIRED_FIELDS.filter(
    (field) => !mapping[field.key]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Columnas detectadas: <strong>{headers.length}</strong>
          </p>
        </div>
        <div>
          {missingRequired.length > 0 ? (
            <Badge variant="destructive" className="gap-1">
              {missingRequired.length} campos requeridos sin mapear
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
              ✓ Todos los campos requeridos mapeados
            </Badge>
          )}
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[200px_1fr_1fr] gap-4 text-xs font-medium text-muted-foreground uppercase border-b pb-2">
        <div>Campo del Sistema</div>
        <div>Columna del CSV</div>
        <div>Muestra</div>
      </div>

      {/* Required Fields */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Campos Requeridos
        </p>
        {REQUIRED_FIELDS.map(renderFieldRow)}
      </div>

      {/* Optional Fields */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Campos Opcionales
        </p>
        {OPTIONAL_FIELDS.map(renderFieldRow)}
      </div>

      {/* Info box */}
      <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
        <p>
          <strong>Tip:</strong> Si no tienes un número de tracking, el sistema generará uno automáticamente para cada envío.
        </p>
      </div>
    </div>
  );
}

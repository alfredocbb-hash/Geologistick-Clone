import { useState, useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileUp,
} from "lucide-react";
import {
  parseCSV,
  autoDetectColumnMapping,
  validateRow,
  parsePrice,
  parseCoordinate,
  cleanPhoneNumber,
  ColumnMapping,
  CSVParseResult,
  CSVParseError,
} from "@/lib/csvParser";
import CSVPreviewTable from "./CSVPreviewTable";
import ColumnMapper from "./ColumnMapper";

interface ImportShipmentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

interface ImportProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export default function ImportShipmentsDialog({
  open,
  onOpenChange,
  onImportComplete,
}: ImportShipmentsDialogProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null);
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [validationErrors, setValidationErrors] = useState<CSVParseError[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "importing" | "complete">("upload");

  const resetState = useCallback(() => {
    setFile(null);
    setParseResult(null);
    setMapping({});
    setValidationErrors([]);
    setIsImporting(false);
    setProgress(null);
    setStep("upload");
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      toast.error("Por favor selecciona un archivo CSV");
      return;
    }

    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const result = parseCSV(content);

        if (result.errors.length > 0 && result.rows.length === 0) {
          toast.error("Error al parsear el archivo CSV");
          return;
        }

        // Auto-detect column mapping
        const detectedMapping = autoDetectColumnMapping(result.headers);
        setMapping(detectedMapping);

        // Validate rows
        const errors: CSVParseError[] = [...result.errors];
        result.rows.forEach((row, index) => {
          const error = validateRow(row, detectedMapping, index + 2);
          if (error) errors.push(error);
        });

        setValidationErrors(errors);
        setParseResult(result);
        setStep("mapping");
      } catch (error) {
        console.error("Error parsing CSV:", error);
        toast.error("Error al leer el archivo CSV");
      }
    };
    reader.readAsText(selectedFile, "UTF-8");
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) {
      const input = fileInputRef.current;
      if (input) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(droppedFile);
        input.files = dataTransfer.files;
        handleFileSelect({ target: input } as any);
      }
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  // Find or create a client
  const findOrCreateClient = async (
    name: string,
    phone: string,
    address?: string,
    city?: string,
    email?: string,
    lat?: number | null,
    lng?: number | null
  ): Promise<string | null> => {
    if (!name || !phone) return null;

    const cleanedPhone = cleanPhoneNumber(phone);

    // Try to find existing client by phone
    const { data: existingClient } = await supabase
      .from("clientes")
      .select("id")
      .eq("telefono", cleanedPhone)
      .eq("tenant_id", profile?.tenant_id)
      .maybeSingle();

    if (existingClient) {
      return existingClient.id;
    }

    // Create new client
    const { data: newClient, error } = await supabase
      .from("clientes")
      .insert({
        nombre: name,
        telefono: cleanedPhone,
        direccion: address || "Sin dirección",
        ciudad: city,
        email,
        lat,
        lng,
        tenant_id: profile?.tenant_id,
        sucursal_id: profile?.sucursal_id,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating client:", error);
      return null;
    }

    return newClient.id;
  };

  // Generate unique tracking number
  const generateTrackingNumber = (orderNumber: string): string => {
    const prefix = "IMP";
    const timestamp = Date.now().toString(36).toUpperCase();
    const cleanOrder = orderNumber.replace(/\D/g, "").slice(-8);
    return `${prefix}${cleanOrder || timestamp}`;
  };

  // Helper function to get row value with flexible matching
  const getRowValue = (row: Record<string, string>, columnKey: string | undefined): string => {
    if (!columnKey) return '';
    
    // Try exact match first
    if (row[columnKey] !== undefined) return row[columnKey];
    
    // Try trimmed match
    const trimmedKey = columnKey.trim();
    for (const key of Object.keys(row)) {
      if (key.trim() === trimmedKey) {
        return row[key];
      }
    }
    
    // Try case-insensitive match
    const lowerKey = trimmedKey.toLowerCase();
    for (const key of Object.keys(row)) {
      if (key.trim().toLowerCase() === lowerKey) {
        return row[key];
      }
    }
    
    return '';
  };

  // Check for duplicates within the same CSV
  const checkCSVDuplicates = useCallback((rows: Record<string, string>[], trackingColumn: string | undefined): Map<string, number[]> => {
    const duplicates = new Map<string, number[]>();
    const seen = new Map<string, number>();
    
    if (!trackingColumn) return duplicates;
    
    rows.forEach((row, index) => {
      const tracking = getRowValue(row, trackingColumn)?.trim().toLowerCase();
      if (!tracking) return;
      
      if (seen.has(tracking)) {
        const firstIndex = seen.get(tracking)!;
        if (!duplicates.has(tracking)) {
          duplicates.set(tracking, [firstIndex]);
        }
        duplicates.get(tracking)!.push(index);
      } else {
        seen.set(tracking, index);
      }
    });
    
    return duplicates;
  }, []);

  // Import shipments mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      if (!parseResult || !profile) throw new Error("No hay datos para importar");

      setIsImporting(true);
      setStep("importing");

      // Note: csvDuplicates is used for in-batch deduplication via importedTrackings
      const csvDuplicates = checkCSVDuplicates(parseResult.rows, mapping.trackingNumber || mapping.orderNumber);
      void csvDuplicates; // Acknowledge we're aware of this variable

      const progressState: ImportProgress = {
        total: parseResult.rows.length,
        processed: 0,
        successful: 0,
        failed: 0,
        errors: [],
      };
      setProgress(progressState);

      // Track already imported trackings in this batch
      const importedTrackings = new Set<string>();

      for (let i = 0; i < parseResult.rows.length; i++) {
        const row = parseResult.rows[i];
        const rowNumber = i + 2;

        try {
          // Extract data from row using mapping with flexible matching
          const trackingNumber = 
            getRowValue(row, mapping.trackingNumber) || 
            getRowValue(row, mapping.orderNumber) ||
            generateTrackingNumber(String(i));
          
          const recipientName = getRowValue(row, mapping.recipientName);
          const recipientAddress = getRowValue(row, mapping.recipientAddress);
          const recipientCity = getRowValue(row, mapping.recipientCity);
          const recipientPhone = getRowValue(row, mapping.recipientPhone);
          const senderName = getRowValue(row, mapping.senderName);
          const senderEmail = getRowValue(row, mapping.senderEmail);
          const totalPrice = parsePrice(getRowValue(row, mapping.totalPrice));
          const notes = getRowValue(row, mapping.notes);
          const lat = parseCoordinate(getRowValue(row, mapping.recipientLat));
          const lng = parseCoordinate(getRowValue(row, mapping.recipientLng));

          // Validate required fields
          if (!recipientName || !recipientAddress) {
            throw new Error("Faltan datos obligatorios (destinatario o dirección)");
          }

          // Normalize tracking for duplicate check
          const normalizedTracking = trackingNumber.trim().toLowerCase();

          // Check for duplicate within the same CSV (skip if already imported in this batch)
          if (importedTrackings.has(normalizedTracking)) {
            throw new Error(`Tracking ${trackingNumber} duplicado en el CSV (ya importado en esta sesión)`);
          }

          // Check for duplicate tracking number in database
          const { data: existingEnvio } = await supabase
            .from("envios")
            .select("id")
            .eq("tracking_number", trackingNumber)
            .eq("tenant_id", profile.tenant_id)
            .maybeSingle();

          if (existingEnvio) {
            throw new Error(`Tracking ${trackingNumber} ya existe en el sistema`);
          }

          // Find or create recipient
          const destinatarioId = await findOrCreateClient(
            recipientName,
            recipientPhone || "0000000000",
            recipientAddress,
            recipientCity,
            undefined,
            lat,
            lng
          );

          // Find or create sender (optional)
          let remitenteId: string | null = null;
          if (senderName) {
            remitenteId = await findOrCreateClient(
              senderName,
              "0000000000",
              undefined,
              undefined,
              senderEmail
            );
          }

          // Get tipo_pago from mapping if exists, default to 'contado'
          const tipoPagoRaw = getRowValue(row, mapping.tipoPago);
          const tipoPago = tipoPagoRaw?.toLowerCase().includes('destino') ? 'destino' : 
                          tipoPagoRaw?.toLowerCase().includes('cuenta') ? 'cuenta_corriente' : 'contado';
          
          // Create shipment
            const { error: envioError } = await supabase
              .from("envios")
              .insert({
                tracking_number: trackingNumber,
                destinatario_id: destinatarioId,
                remitente_id: remitenteId,
                nombre_destinatario: recipientName,
                nombre_remitente: senderName || null,
                direccion_entrega: recipientAddress,
              ciudad_entrega: recipientCity,
              destinatario_lat: lat,
              destinatario_lng: lng,
              whatsapp_destinatario: recipientPhone ? cleanPhoneNumber(recipientPhone) : null,
              precio_total: totalPrice || 0,
              notas: notes,
              estado: "pendiente",
              tenant_id: profile.tenant_id,
              sucursal_origen_id: profile.sucursal_id,
              created_by: profile.user_id,
              tipo_pago: tipoPago,
              pago_contra_entrega: tipoPago === 'destino',
            });

          if (envioError) throw envioError;

          // Mark as imported in this batch
          importedTrackings.add(normalizedTracking);
          progressState.successful++;
        } catch (error: any) {
          progressState.failed++;
          progressState.errors.push({
            row: rowNumber,
            message: error.message || "Error desconocido",
          });
        }

        progressState.processed++;
        setProgress({ ...progressState });
      }

      return progressState;
    },
    onSuccess: (result) => {
      setIsImporting(false);
      setStep("complete");
      queryClient.invalidateQueries({ queryKey: ["envios-planificador"] });
      
      if (result.successful > 0) {
        toast.success(`Se importaron ${result.successful} envíos correctamente`);
      }
      if (result.failed > 0) {
        toast.warning(`${result.failed} envíos no pudieron ser importados`);
      }
      
      onImportComplete?.();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al importar envíos");
      setIsImporting(false);
      setStep("preview");
    },
  });

  const handleClose = () => {
    if (isImporting) return;
    resetState();
    onOpenChange(false);
  };

  const validRowsCount = parseResult 
    ? parseResult.rows.length - validationErrors.filter(e => e.data).length 
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Envíos desde CSV
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Selecciona un archivo CSV para importar envíos al sistema"}
            {step === "mapping" && "Asigna las columnas del CSV a los campos del sistema"}
            {step === "preview" && "Revisa los datos antes de importar"}
            {step === "importing" && "Importando envíos..."}
            {step === "complete" && "Importación completada"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {/* Upload Step */}
          {step === "upload" && (
            <div
              className="border-2 border-dashed rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                Arrastra un archivo CSV aquí
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                o haz clic para seleccionar
              </p>
              <Button variant="outline" type="button">
                <FileUp className="mr-2 h-4 w-4" />
                Seleccionar archivo
              </Button>
            </div>
          )}

          {/* Mapping Step */}
          {step === "mapping" && parseResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-4">
                <Badge variant="outline" className="gap-1">
                  <FileSpreadsheet className="h-3 w-3" />
                  {file?.name}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {parseResult.totalRows} filas detectadas
                </span>
              </div>
              <ColumnMapper
                headers={parseResult.headers}
                rows={parseResult.rows}
                mapping={mapping}
                onMappingChange={setMapping}
              />
            </div>
          )}

          {/* Preview Step */}
          {step === "preview" && parseResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="gap-1">
                    <FileSpreadsheet className="h-3 w-3" />
                    {file?.name}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {parseResult.totalRows} filas • Delimitador: "{parseResult.delimiter}"
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {validationErrors.length > 0 ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {validationErrors.length} advertencias
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                      <CheckCircle2 className="h-3 w-3" />
                      Sin errores
                    </Badge>
                  )}
                </div>
              </div>

              {/* Column detection info */}
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm font-medium mb-2">Columnas detectadas:</p>
                <div className="flex flex-wrap gap-2">
                  {mapping.trackingNumber && (
                    <Badge variant="secondary">Tracking: {mapping.trackingNumber}</Badge>
                  )}
                  {mapping.recipientName && (
                    <Badge variant="secondary">Destinatario: {mapping.recipientName}</Badge>
                  )}
                  {mapping.recipientAddress && (
                    <Badge variant="secondary">Dirección: {mapping.recipientAddress}</Badge>
                  )}
                  {mapping.recipientPhone && (
                    <Badge variant="secondary">Teléfono: {mapping.recipientPhone}</Badge>
                  )}
                  {mapping.recipientLat && mapping.recipientLng && (
                    <Badge variant="secondary">Coordenadas: ✓</Badge>
                  )}
                  {mapping.totalPrice && (
                    <Badge variant="secondary">Precio: {mapping.totalPrice}</Badge>
                  )}
                </div>
              </div>

              {/* Preview Table */}
              <CSVPreviewTable
                headers={parseResult.headers}
                rows={parseResult.rows}
                mapping={mapping}
                errors={validationErrors}
              />

              {validationErrors.length > 0 && (
                <div className="bg-destructive/10 rounded-lg p-3">
                  <p className="text-sm font-medium text-destructive mb-2">
                    Errores de validación:
                  </p>
                  <ul className="text-sm text-destructive space-y-1 max-h-24 overflow-y-auto">
                    {validationErrors.slice(0, 5).map((error, i) => (
                      <li key={i}>
                        Fila {error.row}: {error.message}
                      </li>
                    ))}
                    {validationErrors.length > 5 && (
                      <li className="text-muted-foreground">
                        ... y {validationErrors.length - 5} errores más
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Importing Step */}
          {step === "importing" && progress && (
            <div className="space-y-6 py-8">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
                <p className="text-lg font-medium">
                  Importando envíos...
                </p>
                <p className="text-sm text-muted-foreground">
                  {progress.processed} de {progress.total} procesados
                </p>
              </div>
              <Progress 
                value={(progress.processed / progress.total) * 100} 
                className="h-2"
              />
              <div className="flex justify-center gap-4">
                <Badge variant="outline" className="gap-1 text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  {progress.successful} exitosos
                </Badge>
                {progress.failed > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    {progress.failed} fallidos
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Complete Step */}
          {step === "complete" && progress && (
            <div className="space-y-6 py-8">
              <div className="text-center">
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <p className="text-xl font-semibold mb-2">
                  Importación Completada
                </p>
                <p className="text-muted-foreground">
                  Se procesaron {progress.total} registros
                </p>
              </div>

              <div className="flex justify-center gap-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">{progress.successful}</p>
                  <p className="text-sm text-muted-foreground">Importados</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-destructive">{progress.failed}</p>
                  <p className="text-sm text-muted-foreground">Fallidos</p>
                </div>
              </div>

              {progress.errors.length > 0 && (
                <div className="bg-destructive/10 rounded-lg p-4">
                  <p className="font-medium text-destructive mb-2">Errores durante la importación:</p>
                  <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
                    {progress.errors.map((error, i) => (
                      <li key={i} className="text-destructive">
                        Fila {error.row}: {error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}

          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={resetState}>
                ← Cambiar archivo
              </Button>
              <Button
                onClick={() => {
                  // Re-validate with current mapping before preview
                  if (parseResult) {
                    const errors: CSVParseError[] = [...parseResult.errors];
                    parseResult.rows.forEach((row, index) => {
                      const error = validateRow(row, mapping, index + 2);
                      if (error) errors.push(error);
                    });
                    setValidationErrors(errors);
                  }
                  setStep("preview");
                }}
                disabled={!mapping.recipientName || !mapping.recipientAddress}
              >
                Continuar →
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("mapping")}>
                ← Volver al mapeo
              </Button>
              <Button
                onClick={() => importMutation.mutate()}
                disabled={validRowsCount === 0}
              >
                <Upload className="mr-2 h-4 w-4" />
                Importar {validRowsCount} envíos
              </Button>
            </>
          )}

          {step === "complete" && (
            <Button onClick={handleClose}>
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

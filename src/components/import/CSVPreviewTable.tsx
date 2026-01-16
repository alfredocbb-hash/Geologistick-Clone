import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { CSVParseError, ColumnMapping } from "@/lib/csvParser";

interface CSVPreviewTableProps {
  headers: string[];
  rows: Record<string, string>[];
  mapping: Partial<ColumnMapping>;
  errors: CSVParseError[];
  maxRows?: number;
}

export default function CSVPreviewTable({ 
  headers, 
  rows, 
  mapping,
  errors,
  maxRows = 10 
}: CSVPreviewTableProps) {
  // Get mapped column headers to highlight
  const mappedHeaders = Object.values(mapping).filter(Boolean) as string[];
  
  // Get key columns for display
  const keyColumns = [
    mapping.trackingNumber,
    mapping.orderNumber,
    mapping.recipientName,
    mapping.recipientAddress,
    mapping.recipientCity,
    mapping.recipientPhone,
    mapping.totalPrice,
  ].filter(Boolean) as string[];
  
  // Limit display columns to key ones, or first 6 if no mapping
  const displayColumns = keyColumns.length > 0 
    ? keyColumns 
    : headers.slice(0, 6);
  
  const displayRows = rows.slice(0, maxRows);
  const errorRowNumbers = new Set(errors.map(e => e.row));
  
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-muted z-10">
            <TableRow>
              <TableHead className="w-12 text-center">#</TableHead>
              {displayColumns.map((header) => (
                <TableHead 
                  key={header}
                  className={mappedHeaders.includes(header) ? "bg-primary/10 font-semibold" : ""}
                >
                  {header}
                </TableHead>
              ))}
              <TableHead className="w-24 text-center">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((row, index) => {
              const rowNumber = index + 2; // Account for header row
              const hasError = errorRowNumbers.has(rowNumber);
              const rowError = errors.find(e => e.row === rowNumber);
              
              return (
                <TableRow 
                  key={index}
                  className={hasError ? "bg-destructive/10" : ""}
                >
                  <TableCell className="text-center text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  {displayColumns.map((header) => (
                    <TableCell 
                      key={header}
                      className="max-w-[200px] truncate"
                      title={row[header] || ''}
                    >
                      {row[header] || '-'}
                    </TableCell>
                  ))}
                  <TableCell className="text-center">
                    {hasError ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Error
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                        <CheckCircle className="h-3 w-3" />
                        OK
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      
      {rows.length > maxRows && (
        <div className="p-3 bg-muted/50 text-sm text-muted-foreground text-center border-t">
          Mostrando {maxRows} de {rows.length} filas
        </div>
      )}
    </div>
  );
}

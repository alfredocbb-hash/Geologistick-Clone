import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, X, Loader2, Package } from 'lucide-react';

const syncStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendiente: { label: 'Pendiente', variant: 'secondary' },
  aceptado: { label: 'Aceptado', variant: 'default' },
  rechazado: { label: 'Rechazado', variant: 'destructive' },
  en_curso: { label: 'En Curso', variant: 'outline' },
  completado: { label: 'Completado', variant: 'default' },
};

interface PartnerShipmentsTabProps {
  shipments: any[];
  isLoading: boolean;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  isAccepting: boolean;
  isRejecting: boolean;
}

export function PartnerShipmentsTab({ shipments, isLoading, onAccept, onReject, isAccepting, isRejecting }: PartnerShipmentsTabProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (shipments.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12 text-muted-foreground">
          <Package className="mx-auto h-12 w-12 mb-4 opacity-30" />
          <p>No hay envíos recibidos de partners</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tracking Origen</TableHead>
              <TableHead>Destinatario</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shipments.map((s) => {
              const meta = s.metadata as any;
              const statusCfg = syncStatusConfig[s.estado_sync] || syncStatusConfig.pendiente;
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-sm text-primary">{meta?.tracking_origen || '-'}</TableCell>
                  <TableCell>{meta?.nombre_destinatario || '-'}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">{meta?.direccion_entrega || '-'}</TableCell>
                  <TableCell className="text-sm">{meta?.ciudad_entrega || '-'}</TableCell>
                  <TableCell><Badge variant={statusCfg.variant}>{statusCfg.label}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString('es-AR')}
                  </TableCell>
                  <TableCell className="text-center">
                    {s.estado_sync === 'pendiente' ? (
                      <div className="flex justify-center gap-2">
                        <Button size="sm" onClick={() => onAccept(s.id)} disabled={isAccepting}>
                          {isAccepting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                          Aceptar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onReject(s.id)} disabled={isRejecting}>
                          <X className="mr-1 h-3 w-3" /> Rechazar
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

import { useState } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertTriangle, 
  Search, 
  UserX, 
  XCircle, 
  MapPinOff, 
  PackageX, 
  HelpCircle,
  RefreshCw,
  Loader2,
  CheckCircle,
  Clock,
  Eye,
  Undo2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import IncidentActionDialog from '@/components/incidents/IncidentActionDialog';
import ReturnToSenderDialog from '@/components/incidents/ReturnToSenderDialog';
import { ShipmentDetailsDialog } from '@/components/shipments/ShipmentDetailsDialog';
import { ShipmentHistoryDialog } from '@/components/shipments/ShipmentHistoryDialog';


const INCIDENT_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  ausente: { label: 'Cliente Ausente', icon: UserX, color: 'bg-amber-500' },
  rechazo: { label: 'Rechazó Paquete', icon: XCircle, color: 'bg-red-500' },
  direccion_incorrecta: { label: 'Dirección Incorrecta', icon: MapPinOff, color: 'bg-orange-500' },
  paquete_dañado: { label: 'Paquete Dañado', icon: PackageX, color: 'bg-destructive' },
  otro: { label: 'Otro', icon: HelpCircle, color: 'bg-muted-foreground' },
};

interface Incident {
  id: string;
  tipo: string;
  descripcion: string | null;
  foto_evidencia: string | null;
  estado: string;
  accion_tomada: string | null;
  resolucion: string | null;
  resuelto_at: string | null;
  created_at: string;
  envio: {
    id: string;
    tracking_number: string;
    estado: string;
    reprogramado_count: number | null;
    nombre_destinatario: string | null;
    nombre_remitente: string | null;
    direccion_entrega: string | null;
    ciudad_entrega: string | null;
    whatsapp_destinatario: string | null;
  };
  chofer: {
    nombre: string | null;
    apellido: string | null;
  } | null;
  resuelto_por_profile: {
    nombre: string | null;
    apellido: string | null;
  } | null;
}

export default function Incidents() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = usePersistedState<'pendiente' | 'resuelto' | 'canceladas'>('ui-tab-incidents', 'pendiente');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [historyEnvio, setHistoryEnvio] = useState<{ id: string; tracking: string } | null>(null);
  const [returnEnvio, setReturnEnvio] = useState<{ id: string; tracking: string; destinatario: string | null; estado: string } | null>(null);


  // Fetch incidents
  const { data: incidents, isLoading, error, refetch } = useQuery({
    queryKey: ['incidents', activeTab, profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];
      
      const { data, error } = await supabase
        .from('incidentes')
        .select(`
          id,
          tipo,
          descripcion,
          foto_evidencia,
          estado,
          accion_tomada,
          resolucion,
          resuelto_at,
          resuelto_por,
          created_at,
          envio:envios!incidentes_envio_id_fkey(
            id, tracking_number, estado, reprogramado_count,
            nombre_destinatario, direccion_entrega, ciudad_entrega, whatsapp_destinatario
          ),
          chofer:profiles!incidentes_chofer_id_fkey(nombre, apellido)
        `)
        .eq('tenant_id', profile.tenant_id)
        .eq('estado', activeTab)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch resuelto_por profiles separately if needed
      const incidentsWithResolver = await Promise.all(
        (data || []).map(async (incident: any) => {
          if (incident.resuelto_por) {
            const { data: resolverProfile } = await supabase
              .from('profiles')
              .select('nombre, apellido')
              .eq('user_id', incident.resuelto_por)
              .single();
            return { ...incident, resuelto_por_profile: resolverProfile };
          }
          return { ...incident, resuelto_por_profile: null };
        })
      );
      
      return incidentsWithResolver as Incident[];
    },
    enabled: !!profile?.tenant_id && activeTab !== 'canceladas',
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Cancelled / returned shipments (separate source)
  const { data: canceladas, isLoading: isLoadingCanceladas, refetch: refetchCanceladas } = useQuery({
    queryKey: ['incidents-canceladas', profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      const { data: envios, error: enviosError } = await supabase
        .from('envios')
        .select(`
          id, tracking_number, tracking_externo, estado, updated_at,
          nombre_destinatario, direccion_entrega, ciudad_entrega
        `)
        .eq('tenant_id', profile.tenant_id)
        .in('estado', ['cancelado', 'devuelto'])
        .order('updated_at', { ascending: false })
        .limit(500);

      if (enviosError) throw enviosError;
      if (!envios?.length) return [];

      const allEnvioIds = envios.map(e => e.id);

      // Only include shipments that actually went out for delivery at some point
      const { data: reparto } = await supabase
        .from('envio_historial')
        .select('envio_id')
        .in('envio_id', allEnvioIds)
        .eq('estado_nuevo', 'en_reparto');

      const salieronReparto = new Set((reparto || []).map((r: any) => r.envio_id));
      const enviosFiltrados = envios.filter(e => salieronReparto.has(e.id));
      if (!enviosFiltrados.length) return [];

      const envioIds = enviosFiltrados.map(e => e.id);

      // Last history entry that transitioned into the final state
      const { data: historial } = await supabase
        .from('envio_historial')
        .select('envio_id, estado_nuevo, notas, created_at, created_by')
        .in('envio_id', envioIds)
        .in('estado_nuevo', ['cancelado', 'devuelto'])
        .order('created_at', { ascending: false });

      // Related incident with cancelar/devolver action
      const { data: incidenciasRel } = await supabase
        .from('incidentes')
        .select('envio_id, accion_tomada, resolucion, resuelto_at, resuelto_por')
        .in('envio_id', envioIds)
        .in('accion_tomada', ['cancelar', 'devolver']);

      const userIds = Array.from(new Set([
        ...(historial || []).map((h: any) => h.created_by).filter(Boolean),
        ...(incidenciasRel || []).map((i: any) => i.resuelto_por).filter(Boolean),
      ]));

      let profilesMap: Record<string, { nombre: string; apellido: string | null }> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, nombre, apellido')
          .in('user_id', userIds as string[]);
        profs?.forEach((p: any) => { profilesMap[p.user_id] = { nombre: p.nombre, apellido: p.apellido }; });
      }

      return enviosFiltrados.map((env: any) => {
        const inc = incidenciasRel?.find((i: any) => i.envio_id === env.id);
        const hist = historial?.find((h: any) => h.envio_id === env.id && h.estado_nuevo === env.estado);
        const motivo = inc?.resolucion || hist?.notas || null;
        const fecha = inc?.resuelto_at || hist?.created_at || env.updated_at;
        const cerradoPor = (inc?.resuelto_por && profilesMap[inc.resuelto_por])
          || (hist?.created_by && profilesMap[hist.created_by])
          || null;
        return { envio: env, motivo, fecha, cerrado_por: cerradoPor, accion: inc?.accion_tomada || null };
      });
    },
    enabled: !!profile?.tenant_id && activeTab === 'canceladas',
    staleTime: 0,
  });


  // Filter incidents by search term
  const filteredIncidents = incidents?.filter(incident => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      incident.envio?.tracking_number?.toLowerCase().includes(search) ||
      incident.envio?.nombre_destinatario?.toLowerCase().includes(search) ||
      incident.envio?.direccion_entrega?.toLowerCase().includes(search) ||
      incident.chofer?.nombre?.toLowerCase().includes(search) ||
      incident.chofer?.apellido?.toLowerCase().includes(search)
    );
  });

  // Filter cancelled shipments by search term
  const filteredCanceladas = canceladas?.filter(row => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      row.envio?.tracking_number?.toLowerCase().includes(s) ||
      row.envio?.tracking_externo?.toLowerCase().includes(s) ||
      row.envio?.nombre_destinatario?.toLowerCase().includes(s) ||
      row.envio?.direccion_entrega?.toLowerCase().includes(s) ||
      row.motivo?.toLowerCase().includes(s)
    );
  });

  // Count pending incidents
  const pendingCount = activeTab === 'pendiente' 
    ? filteredIncidents?.length || 0
    : incidents?.length || 0;


  const getIncidentTypeInfo = (tipo: string) => {
    return INCIDENT_TYPE_CONFIG[tipo] || INCIDENT_TYPE_CONFIG.otro;
  };

  const getActionBadge = (action: string | null) => {
    if (!action) return null;
    const actionLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      're_intento': { label: 'Re-intentado', variant: 'default' },
      'reprogramar': { label: 'Reprogramado', variant: 'secondary' },
      'corregir_direccion': { label: 'Dirección corregida', variant: 'outline' },
      'devolver': { label: 'Devuelto', variant: 'destructive' },
      'cancelar': { label: 'Cancelado', variant: 'destructive' },
    };
    const config = actionLabels[action] || { label: action, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-warning" />
            Bandeja de Incidencias
          </h1>
          <p className="text-muted-foreground">
            Gestiona los envíos con problemas reportados por choferes
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { refetch(); refetchCanceladas(); }}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>

      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-warning/10">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pendientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {activeTab === 'resuelto' ? filteredIncidents?.length || 0 : '-'}
                </p>
                <p className="text-sm text-muted-foreground">Resueltos (hoy)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-500/10">
                <PackageX className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {canceladas?.length ?? 0}
                </p>
                <p className="text-sm text-muted-foreground">Canceladas / Devoluciones</p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pendiente' | 'resuelto' | 'canceladas')}>
              <TabsList>
                <TabsTrigger value="pendiente" className="gap-2">
                  <Clock className="h-4 w-4" />
                  Pendientes
                  {pendingCount > 0 && (
                    <Badge variant="destructive" className="ml-1">{pendingCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="resuelto" className="gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Resueltos
                </TabsTrigger>
                <TabsTrigger value="canceladas" className="gap-2">
                  <PackageX className="h-4 w-4" />
                  Canceladas / Devoluciones
                  {(canceladas?.length ?? 0) > 0 && (
                    <Badge variant="secondary" className="ml-1">{canceladas!.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por tracking, cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === 'canceladas' ? (
            isLoadingCanceladas ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !filteredCanceladas?.length ? (
              <div className="text-center py-12">
                <PackageX className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No hay envíos cancelados ni devoluciones</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tracking</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Destinatario</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Cerrado por</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCanceladas.map((row) => {
                      const tracking = row.envio.tracking_externo || row.envio.tracking_number;
                      const isDevuelto = row.envio.estado === 'devuelto';
                      return (
                        <TableRow key={row.envio.id}>
                          <TableCell>
                            <button
                              onClick={() => setSelectedShipmentId(row.envio.id)}
                              className="font-mono text-sm font-medium text-primary hover:underline"
                            >
                              {tracking}
                            </button>
                          </TableCell>
                          <TableCell>
                            <Badge variant={isDevuelto ? 'destructive' : 'secondary'}>
                              {isDevuelto ? 'Devuelto' : 'Cancelado'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{row.envio.nombre_destinatario || '-'}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[240px]">
                                {row.envio.direccion_entrega}{row.envio.ciudad_entrega ? `, ${row.envio.ciudad_entrega}` : ''}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-muted-foreground max-w-[280px] whitespace-pre-wrap">
                              {row.motivo || <span className="italic">Sin motivo registrado</span>}
                            </p>
                          </TableCell>
                          <TableCell>
                            {row.cerrado_por
                              ? `${row.cerrado_por.nombre || ''} ${row.cerrado_por.apellido || ''}`.trim() || '-'
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p>{format(new Date(row.fecha), 'dd/MM/yyyy', { locale: es })}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(row.fecha), 'HH:mm', { locale: es })}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {row.envio.estado === 'cancelado' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                                  onClick={() => setReturnEnvio({
                                    id: row.envio.id,
                                    tracking,
                                    destinatario: row.envio.nombre_destinatario,
                                    estado: row.envio.estado,
                                  })}
                                >
                                  <Undo2 className="h-4 w-4 mr-1" />
                                  Devolver
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setHistoryEnvio({ id: row.envio.id, tracking })}
                                title="Ver historial"
                              >
                                <Clock className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedShipmentId(row.envio.id)}
                                title="Ver detalle"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )
          ) : isLoading ? (

            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12 space-y-4">
              <XCircle className="h-12 w-12 mx-auto text-destructive/70" />
              <div>
                <p className="text-destructive font-medium">Error al cargar incidencias</p>
                <p className="text-sm text-muted-foreground mt-1">
                  No se pudo obtener la lista. Intenta nuevamente.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reintentar
              </Button>
              {import.meta.env.DEV && (
                <details className="mt-4 text-left max-w-md mx-auto">
                  <summary className="text-xs text-muted-foreground cursor-pointer">
                    Detalle técnico
                  </summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                    {(error as Error).message}
                  </pre>
                </details>
              )}
            </div>
          ) : !filteredIncidents?.length ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {activeTab === 'pendiente' 
                  ? 'No hay incidencias pendientes' 
                  : 'No hay incidencias resueltas'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Destinatario</TableHead>
                    <TableHead>Reportado por</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Intentos</TableHead>
                    {activeTab === 'resuelto' && <TableHead>Acción</TableHead>}
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncidents.map((incident) => {
                    const typeInfo = getIncidentTypeInfo(incident.tipo);
                    const TypeIcon = typeInfo.icon;
                    
                    return (
                      <TableRow key={incident.id}>
                        <TableCell>
                          <button
                            onClick={() => setSelectedShipmentId(incident.envio?.id)}
                            className="font-mono text-sm font-medium text-primary hover:underline"
                          >
                            {incident.envio?.tracking_number}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded ${typeInfo.color}/10`}>
                              <TypeIcon className={`h-4 w-4 ${typeInfo.color.replace('bg-', 'text-')}`} />
                            </div>
                            <span className="text-sm">{typeInfo.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{incident.envio?.nombre_destinatario || '-'}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {incident.envio?.direccion_entrega}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {incident.chofer 
                            ? `${incident.chofer.nombre || ''} ${incident.chofer.apellido || ''}`.trim() || '-'
                            : '-'
                          }
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{format(new Date(incident.created_at), 'dd/MM/yyyy', { locale: es })}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(incident.created_at), 'HH:mm', { locale: es })}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={incident.envio?.reprogramado_count ? 'secondary' : 'outline'}>
                            {incident.envio?.reprogramado_count || 0} intentos
                          </Badge>
                        </TableCell>
                        {activeTab === 'resuelto' && (
                          <TableCell>
                            {getActionBadge(incident.accion_tomada)}
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          {activeTab === 'pendiente' ? (
                            <Button 
                              size="sm" 
                              onClick={() => setSelectedIncident(incident)}
                            >
                              Resolver
                            </Button>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setSelectedIncident(incident)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      {selectedIncident && (
        <IncidentActionDialog
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['incidents'] });
            setSelectedIncident(null);
          }}
          readOnly={activeTab === 'resuelto'}
        />
      )}

      {/* Shipment Details Dialog */}
      <ShipmentDetailsDialog
        open={!!selectedShipmentId}
        onOpenChange={(open) => !open && setSelectedShipmentId(null)}
        envioId={selectedShipmentId}
      />



      {/* Shipment History Dialog */}
      <ShipmentHistoryDialog
        open={!!historyEnvio}
        onOpenChange={(open) => !open && setHistoryEnvio(null)}
        envioId={historyEnvio?.id ?? null}
        trackingNumber={historyEnvio?.tracking ?? ''}
      />

      {/* Return to sender */}
      <ReturnToSenderDialog
        open={!!returnEnvio}
        onOpenChange={(open) => !open && setReturnEnvio(null)}
        envioId={returnEnvio?.id ?? null}
        currentStatus={returnEnvio?.estado ?? 'cancelado'}
        tracking={returnEnvio?.tracking ?? ''}
        destinatario={returnEnvio?.destinatario ?? null}
      />
    </div>
  );
}


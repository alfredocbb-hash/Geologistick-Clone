import { useState } from 'react';
import { usePartners } from '@/hooks/usePartners';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Handshake, Search, Plus, Check, X, Loader2, Building2, Percent, FileDown } from 'lucide-react';
import { PartnerShipmentsTab } from '@/components/partners/PartnerShipmentsTab';
import { PartnerComisionesDialog } from '@/components/partners/PartnerComisionesDialog';
import { NewPartnershipComisiones, type ComisionDraft } from '@/components/partners/NewPartnershipComisiones';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { generatePartnerAgreementPDF } from '@/lib/generatePartnerAgreementPDF';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const estadoBadge: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendiente: { label: 'Pendiente', variant: 'secondary' },
  activa: { label: 'Activa', variant: 'default' },
  suspendida: { label: 'Suspendida', variant: 'outline' },
  cancelada: { label: 'Cancelada', variant: 'destructive' },
};

export default function Partners() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id || '';
  const {
    partnerships, isLoading, searchTenants, requestPartnership, respondPartnership,
    incomingShipments, incomingShipmentsLoading, acceptShipment, rejectShipment,
  } = usePartners();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [notas, setNotas] = useState('');
  const [comisionesDraft, setComisionesDraft] = useState<ComisionDraft[]>([]);

  // Comisiones dialog state
  const [comisionesDialogOpen, setComisionesDialogOpen] = useState(false);
  const [selectedPartnership, setSelectedPartnership] = useState<any>(null);

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    const results = await searchTenants.mutateAsync(searchQuery);
    setSearchResults(results);
  };

  const handleRequest = async () => {
    if (!selectedTenant) return;
    const comisionesPayload = comisionesDraft
      .filter(c => c.porcentaje_contado > 0 || c.porcentaje_destino > 0 || c.porcentaje_cta_cte > 0)
      .map(({ concepto_id, porcentaje_contado, porcentaje_destino, porcentaje_cta_cte }) => ({
        concepto_id, porcentaje_contado, porcentaje_destino, porcentaje_cta_cte,
      }));
    await requestPartnership.mutateAsync({
      targetTenantId: selectedTenant.id,
      notas,
      comisiones: comisionesPayload,
    });
    setDialogOpen(false);
    setSelectedTenant(null);
    setNotas('');
    setComisionesDraft([]);
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleDownloadAgreement = async (p: any) => {
    try {
      const { data: comisiones } = await supabase
        .from('partner_comisiones' as any)
        .select('*, concepto:tarifa_conceptos(nombre)')
        .eq('partnership_id', p.id);

      await generatePartnerAgreementPDF({
        empresaA: p.partner_name || 'Empresa Partner',
        empresaB: profile?.tenant_id ? 'Mi Empresa' : 'Mi Empresa',
        fecha: new Date(p.created_at).toLocaleDateString('es-AR'),
        notas: p.notas,
        comisiones: (comisiones || []).map((c: any) => ({
          concepto_nombre: c.concepto?.nombre || 'Concepto',
          porcentaje_contado: c.porcentaje_contado,
          porcentaje_destino: c.porcentaje_destino,
          porcentaje_cta_cte: c.porcentaje_cta_cte,
        })),
      });
      toast.success('PDF generado');
    } catch (e: any) {
      toast.error('Error al generar PDF');
    }
  };

  const pendingIncoming = partnerships.filter(p => p.is_incoming_request);
  const pendingIncomingShipments = incomingShipments.filter(s => s.estado_sync === 'pendiente');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Handshake className="h-8 w-8 text-primary" />
            Empresas Asociadas
          </h1>
          <p className="text-muted-foreground mt-1">Gestiona partnerships con otras empresas para derivar envíos</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gradient-primary">
          <Plus className="mr-2 h-4 w-4" />
          Nueva Asociación
        </Button>
      </div>

      <Tabs defaultValue="partnerships" className="space-y-4">
        <TabsList>
          <TabsTrigger value="partnerships">Asociaciones</TabsTrigger>
          <TabsTrigger value="incoming" className="relative">
            Envíos Recibidos
            {pendingIncomingShipments.length > 0 && (
              <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]" variant="destructive">
                {pendingIncomingShipments.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="partnerships" className="space-y-4">
          {pendingIncoming.length > 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader><CardTitle className="text-lg">Solicitudes Pendientes</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {pendingIncoming.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                    <div>
                      <p className="font-medium">{p.partner_name}</p>
                      {p.notas && <p className="text-sm text-muted-foreground">{p.notas}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => respondPartnership.mutate({ partnershipId: p.id, accept: true })} disabled={respondPartnership.isPending}>
                        <Check className="mr-1 h-4 w-4" /> Aceptar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => respondPartnership.mutate({ partnershipId: p.id, accept: false })} disabled={respondPartnership.isPending}>
                        <X className="mr-1 h-4 w-4" /> Rechazar
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : partnerships.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Handshake className="mx-auto h-12 w-12 mb-4 opacity-30" />
                  <p>No tienes asociaciones aún</p>
                  <p className="text-sm">Crea una nueva asociación para empezar a derivar envíos</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Permisos</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partnerships.map(p => {
                      const badge = estadoBadge[p.estado] || estadoBadge.pendiente;
                      const permisos = p.permisos as any;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.partner_name}</TableCell>
                          <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {permisos?.puede_derivar && <Badge variant="outline" className="text-xs">Derivar</Badge>}
                              {permisos?.puede_ver_precio && <Badge variant="outline" className="text-xs">Ver Precio</Badge>}
                              {permisos?.puede_ver_cliente && <Badge variant="outline" className="text-xs">Ver Cliente</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{p.notas || '-'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString('es-AR')}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button size="icon" variant="ghost" title="Comisiones" onClick={() => { setSelectedPartnership(p); setComisionesDialogOpen(true); }}>
                                <Percent className="h-4 w-4" />
                              </Button>
                              {p.estado === 'activa' && (
                                <Button size="icon" variant="ghost" title="Descargar Acuerdo" onClick={() => handleDownloadAgreement(p)}>
                                  <FileDown className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incoming">
          <PartnerShipmentsTab
            shipments={incomingShipments}
            isLoading={incomingShipmentsLoading}
            onAccept={(id) => acceptShipment.mutate({ partnerShipmentId: id })}
            onReject={(id) => rejectShipment.mutate(id)}
            isAccepting={acceptShipment.isPending}
            isRejecting={rejectShipment.isPending}
          />
        </TabsContent>
      </Tabs>

      {/* New Partnership Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setComisionesDraft([]); setSelectedTenant(null); } }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-auto">
          <DialogHeader><DialogTitle>Nueva Asociación</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="Buscar empresa por nombre..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
              <Button onClick={handleSearch} disabled={searchTenants.isPending} size="icon" variant="outline">
                {searchTenants.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-auto">
                {searchResults.map(t => (
                  <div key={t.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedTenant?.id === t.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`} onClick={() => setSelectedTenant(t)}>
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{t.nombre}</p>
                      <p className="text-xs text-muted-foreground">{t.slug}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedTenant && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Empresa seleccionada: <span className="text-primary">{selectedTenant.nombre}</span></p>
                <Textarea placeholder="Notas o condiciones comerciales (opcional)" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
                <NewPartnershipComisiones tenantId={tenantId} comisiones={comisionesDraft} onChange={setComisionesDraft} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleRequest} disabled={!selectedTenant || requestPartnership.isPending}>
              {requestPartnership.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enviar Solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comisiones Dialog */}
      {selectedPartnership && (
        <PartnerComisionesDialog
          open={comisionesDialogOpen}
          onOpenChange={setComisionesDialogOpen}
          partnershipId={selectedPartnership.id}
          partnerName={selectedPartnership.partner_name}
          tenantId={tenantId}
        />
      )}
    </div>
  );
}

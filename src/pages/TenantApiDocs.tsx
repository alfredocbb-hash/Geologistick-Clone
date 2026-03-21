import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Key, Plus, Copy, Check, Trash2, Pause, Play, Loader2, AlertTriangle, Eye, EyeOff, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function TenantApiDocs() {
  const { isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const [showKeyPrefix, setShowKeyPrefix] = useState<Record<string, boolean>>({});

  if (!isSuperAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  // Fetch tenants
  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, nombre, slug, activo')
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
  });

  const selectedTenant = tenants.find(t => t.id === selectedTenantId);

  // Fetch API keys for selected tenant
  const { data: apiKeys = [], isLoading: keysLoading } = useQuery({
    queryKey: ['tenant-api-keys', selectedTenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_api_keys')
        .select('*')
        .eq('tenant_id', selectedTenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTenantId,
  });

  const generateKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.functions.invoke('manage-api-keys', {
        body: { action: 'generate', tenant_id: selectedTenantId, name },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setGeneratedKey(data.api_key);
      setNewKeyName('');
      queryClient.invalidateQueries({ queryKey: ['tenant-api-keys', selectedTenantId] });
      toast.success('API Key generada correctamente');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al generar API Key');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ keyId, isActive }: { keyId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('tenant_api_keys')
        .update({ is_active: !isActive })
        .eq('id', keyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-api-keys', selectedTenantId] });
      toast.success('Estado actualizado');
    },
    onError: () => toast.error('Error al actualizar estado'),
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await supabase
        .from('tenant_api_keys')
        .delete()
        .eq('id', keyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-api-keys', selectedTenantId] });
      setDeletingKeyId(null);
      toast.success('API Key eliminada');
    },
    onError: () => toast.error('Error al eliminar API Key'),
  });

  const handleCopyKey = async () => {
    if (!generatedKey) return;
    try {
      await navigator.clipboard.writeText(generatedKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
      toast.success('API Key copiada al portapapeles');
    } catch {
      toast.error('Error al copiar');
    }
  };

  const handleGenerate = () => {
    if (!newKeyName.trim()) {
      toast.error('Ingresa un nombre para la API Key');
      return;
    }
    generateKeyMutation.mutate(newKeyName.trim());
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">API Pública</h1>
        <p className="text-muted-foreground">Gestión de API Keys y documentación de endpoints por empresa</p>
      </div>

      {/* Tenant Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Seleccionar Empresa
          </CardTitle>
          <CardDescription>Elige la empresa para gestionar sus credenciales API</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedTenantId} onValueChange={(v) => { setSelectedTenantId(v); setGeneratedKey(null); }}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder={tenantsLoading ? 'Cargando...' : 'Seleccionar empresa'} />
            </SelectTrigger>
            <SelectContent>
              {tenants.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedTenantId && selectedTenant && (
        <>
          {/* API Keys Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4" />
                API Keys — {selectedTenant.nombre}
              </CardTitle>
              <CardDescription>
                Las API Keys permiten a sistemas externos consultar endpoints públicos. Se muestran una sola vez al crearlas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Generated Key Display */}
              {generatedKey && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium text-sm">¡Guarda esta key ahora! No podrás verla de nuevo.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input value={generatedKey} readOnly className="font-mono text-sm" />
                    <Button variant="outline" size="icon" onClick={handleCopyKey}>
                      {copiedKey ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setGeneratedKey(null); setCopiedKey(false); }} className="text-muted-foreground">
                    Ya la guardé, cerrar
                  </Button>
                </div>
              )}

              {/* Generate New Key */}
              {!generatedKey && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="key-name" className="sr-only">Nombre de la API Key</Label>
                    <Input
                      id="key-name"
                      placeholder="Nombre de la API Key (ej: Integración Horizon)"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                    />
                  </div>
                  <Button onClick={handleGenerate} disabled={generateKeyMutation.isPending || !newKeyName.trim()}>
                    {generateKeyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" />Generar</>}
                  </Button>
                </div>
              )}

              {/* Keys List */}
              {keysLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No hay API Keys configuradas</p>
                  <p className="text-sm">Genera una para compartir con integradores</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Key</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Último Uso</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiKeys.map((key) => (
                        <TableRow key={key.id}>
                          <TableCell className="font-mono text-sm">
                            <div className="flex items-center gap-1">
                              {showKeyPrefix[key.id] ? key.api_key_prefix : '••••••••'}
                              <Button variant="ghost" size="icon" className="h-6 w-6"
                                onClick={() => setShowKeyPrefix(prev => ({ ...prev, [key.id]: !prev[key.id] }))}>
                                {showKeyPrefix[key.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>{key.name}</TableCell>
                          <TableCell>
                            <Badge variant={key.is_active ? 'default' : 'secondary'}>
                              {key.is_active ? 'Activa' : 'Inactiva'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {key.last_used_at ? format(new Date(key.last_used_at), 'dd/MM/yy HH:mm', { locale: es }) : 'Nunca'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8"
                                onClick={() => toggleStatusMutation.mutate({ keyId: key.id, isActive: key.is_active })}
                                disabled={toggleStatusMutation.isPending}>
                                {key.is_active ? <Pause className="h-4 w-4 text-yellow-600" /> : <Play className="h-4 w-4 text-green-600" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeletingKeyId(key.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* API Documentation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">📖 Documentación de la API</CardTitle>
              <CardDescription>
                Endpoints disponibles para integración externa. Base URL: <code className="text-xs">{import.meta.env.VITE_SUPABASE_URL}</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tracking */}
              <div className="space-y-2 border-b pb-4">
                <p className="text-sm font-semibold">1. Tracking de envíos</p>
                <pre className="text-xs bg-muted p-3 rounded-lg border overflow-x-auto">
{`GET /functions/v1/public-tracking?code={TRACKING_NUMBER}
Headers: x-api-key: tu_api_key`}
                </pre>
                <p className="text-xs text-muted-foreground">
                  Sin API Key los datos personales se enmascaran. Con API Key solo se devuelven envíos de la empresa.
                </p>
              </div>

              {/* Cotización */}
              <div className="space-y-2 border-b pb-4">
                <p className="text-sm font-semibold">2. Cotización de tarifas</p>
                <pre className="text-xs bg-muted p-3 rounded-lg border overflow-x-auto">
{`POST /functions/v1/public-rates
Headers: x-api-key: tu_api_key
Content-Type: application/json

Body: {
  "peso": 5,
  "bultos": 2,
  "tipo_servicio": "puerta_puerta",
  "cp_destino": "1425",
  "valor_declarado": 50000
}`}
                </pre>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Parámetros</p>
                  <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                    <li><code>peso</code> — peso en kg (requerido)</li>
                    <li><code>bultos</code> — cantidad (default: 1)</li>
                    <li><code>tipo_servicio</code> — <code>sucursal_sucursal</code>, <code>sucursal_puerta</code>, <code>puerta_sucursal</code>, <code>puerta_puerta</code></li>
                    <li><code>cp_destino</code> / <code>ciudad_destino</code> — filtro de zona (opcional)</li>
                    <li><code>valor_declarado</code> — para cálculo de seguro (opcional)</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Respuesta</p>
                  <pre className="text-xs bg-muted p-3 rounded-lg border overflow-x-auto">
{`{
  "rates": [
    {
      "tarifa": "Envío Estándar",
      "precio": 4850.00,
      "moneda": "ARS",
      "dias_entrega_min": 3,
      "dias_entrega_max": 5
    }
  ],
  "pickup_points": [
    {
      "nombre": "Sucursal Centro",
      "direccion": "Av. Corrientes 1234",
      "ciudad": "CABA",
      "codigo_postal": "1043",
      "lat": -34.60,
      "lng": -58.38
    }
  ]
}`}
                  </pre>
                </div>
              </div>

              {/* Sucursales */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">3. Sucursales activas</p>
                <pre className="text-xs bg-muted p-3 rounded-lg border overflow-x-auto">
{`GET /functions/v1/public-branches?tipo=retiro
Headers: x-api-key: tu_api_key`}
                </pre>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Filtros</p>
                  <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                    <li><code>tipo=todas</code> — todas las activas (default)</li>
                    <li><code>tipo=retiro</code> — solo con retiro de clientes</li>
                    <li><code>tipo=despacho</code> — solo que pueden despachar</li>
                    <li><code>tipo=entrega</code> — solo que realizan entregas</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Respuesta</p>
                  <pre className="text-xs bg-muted p-3 rounded-lg border overflow-x-auto">
{`{
  "sucursales": [
    {
      "nombre": "Sucursal Centro",
      "codigo": "CEN",
      "direccion": "Av. Corrientes 1234",
      "ciudad": "CABA",
      "codigo_postal": "1043",
      "telefono": "+54 11 1234-5678",
      "lat": -34.6037,
      "lng": -58.3816,
      "horario_apertura": "09:00",
      "horario_cierre": "18:00",
      "permite_retiro_clientes": true,
      "puede_despachar": true,
      "realiza_entregas": true
    }
  ]
}`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingKeyId} onOpenChange={() => setDeletingKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Las integraciones que usen esta key dejarán de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingKeyId && deleteKeyMutation.mutate(deletingKeyId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

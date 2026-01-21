import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Key, Plus, Copy, Check, Trash2, Pause, Play, Loader2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TenantApiKeysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: {
    id: string;
    nombre: string;
  };
}

export function TenantApiKeysDialog({ open, onOpenChange, tenant }: TenantApiKeysDialogProps) {
  const queryClient = useQueryClient();
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const [showKeyPrefix, setShowKeyPrefix] = useState<Record<string, boolean>>({});

  // Fetch existing API keys
  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ['tenant-api-keys', tenant.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_api_keys')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Generate new API key
  const generateKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.functions.invoke('manage-api-keys', {
        body: { action: 'generate', tenant_id: tenant.id, name },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setGeneratedKey(data.api_key);
      setNewKeyName('');
      queryClient.invalidateQueries({ queryKey: ['tenant-api-keys', tenant.id] });
      toast.success('API Key generada correctamente');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al generar API Key');
    },
  });

  // Toggle key status
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ keyId, isActive }: { keyId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('tenant_api_keys')
        .update({ is_active: !isActive })
        .eq('id', keyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-api-keys', tenant.id] });
      toast.success('Estado actualizado');
    },
    onError: () => {
      toast.error('Error al actualizar estado');
    },
  });

  // Delete key
  const deleteKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await supabase
        .from('tenant_api_keys')
        .delete()
        .eq('id', keyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-api-keys', tenant.id] });
      setDeletingKeyId(null);
      toast.success('API Key eliminada');
    },
    onError: () => {
      toast.error('Error al eliminar API Key');
    },
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

  const handleCloseGeneratedKey = () => {
    setGeneratedKey(null);
    setCopiedKey(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys - {tenant.nombre}
            </DialogTitle>
            <DialogDescription>
              Las API Keys permiten a sistemas externos consultar el tracking de envíos.
              Las keys se muestran una sola vez al crearlas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Generated Key Display */}
            {generatedKey && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium text-sm">
                    ¡Guarda esta key ahora! No podrás verla de nuevo.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={generatedKey}
                    readOnly
                    className="font-mono text-sm bg-white dark:bg-gray-900"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyKey}
                  >
                    {copiedKey ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseGeneratedKey}
                  className="text-muted-foreground"
                >
                  Ya la guardé, cerrar
                </Button>
              </div>
            )}

            {/* Generate New Key */}
            {!generatedKey && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="key-name" className="sr-only">
                    Nombre de la API Key
                  </Label>
                  <Input
                    id="key-name"
                    placeholder="Nombre de la API Key (ej: Integración Web)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  />
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={generateKeyMutation.isPending || !newKeyName.trim()}
                >
                  {generateKeyMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      Generar
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Keys List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No hay API Keys configuradas</p>
                <p className="text-sm">Genera una para comenzar a integrar</p>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setShowKeyPrefix(prev => ({
                                ...prev,
                                [key.id]: !prev[key.id]
                              }))}
                            >
                              {showKeyPrefix[key.id] ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
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
                          {key.last_used_at
                            ? format(new Date(key.last_used_at), 'dd/MM/yy HH:mm', { locale: es })
                            : 'Nunca'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => toggleStatusMutation.mutate({
                                keyId: key.id,
                                isActive: key.is_active
                              })}
                              disabled={toggleStatusMutation.isPending}
                            >
                              {key.is_active ? (
                                <Pause className="h-4 w-4 text-yellow-600" />
                              ) : (
                                <Play className="h-4 w-4 text-green-600" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeletingKeyId(key.id)}
                            >
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

            {/* Usage Example */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <h4 className="text-sm font-medium">Ejemplo de uso:</h4>
              <pre className="text-xs bg-background p-3 rounded border overflow-x-auto">
{`curl -X GET \\
  "https://uhlgimnmfifmrxraorrl.supabase.co/functions/v1/public-tracking?tracking=XXX-ENV-123" \\
  -H "x-api-key: tu_api_key_aqui"`}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              {deleteKeyMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

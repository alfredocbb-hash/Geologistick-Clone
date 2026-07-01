import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, MoreHorizontal, Store, Settings, Eye, Trash2, RefreshCw, ShoppingCart, Users, DollarSign, Link2, CheckCircle2, XCircle, Loader2, UserCheck, UserX, Mail, MessageSquare, Send, RefreshCcw, LinkIcon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { CreateSellerDialog } from '@/components/ecommerce/CreateSellerDialog';
import { SellerDetailsDialog } from '@/components/ecommerce/SellerDetailsDialog';
import { EditSellerDialog } from '@/components/ecommerce/EditSellerDialog';

interface Seller {
  id: string;
  nombre: string;
  razon_social: string | null;
  email: string;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
  provincia: string | null;
  codigo_postal: string | null;
  cuit: string | null;
  plataforma: string;
  store_id: string | null;
  store_url: string | null;
  has_valid_token: boolean | null;
  sucursal_pickup_id: string | null;
  tarifa_id: string | null;
  activo: boolean;
  tiene_cuenta_corriente: boolean;
  saldo_cuenta_corriente: number;
  limite_credito: number;
  ultimo_sync: string | null;
  created_at: string;
  user_id: string | null;
  cliente_id: string | null;
}

const PLATAFORMA_LABELS: Record<string, { label: string; color: string }> = {
  tiendanube: { label: 'Tiendanube', color: 'bg-blue-500' },
  mercadolibre: { label: 'MercadoLibre', color: 'bg-yellow-500' },
  shopify: { label: 'Shopify', color: 'bg-green-500' },
  woocommerce: { label: 'WooCommerce', color: 'bg-purple-500' },
  manual: { label: 'Manual', color: 'bg-gray-500' },
};

export default function Sellers() {
  const { isSuperAdmin } = useAuth();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [syncingSellerId, setSyncingSellerId] = useState<string | null>(null);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [bulkSyncProgress, setBulkSyncProgress] = useState({ current: 0, total: 0, currentName: '' });
  const [isLinkingSellerId, setIsLinkingSellerId] = useState<string | null>(null);
  const [isBulkLinking, setIsBulkLinking] = useState(false);
  const [bulkLinkProgress, setBulkLinkProgress] = useState({ current: 0, total: 0, currentName: '' });

  // Listen for OAuth success messages from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'tiendanube-oauth-success' || event.data?.type === 'mercadolibre-oauth-success') {
        queryClient.invalidateQueries({ queryKey: ['ecommerce-sellers'] });
        toast({ title: 'Tienda conectada exitosamente' });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [queryClient]);

  // Connect to MercadoLibre
  const handleConnectMercadoLibre = (seller: Seller) => {
    const oauthUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadolibre-oauth/authorize?seller_id=${seller.id}`;
    
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    window.open(
      oauthUrl,
      'mercadolibre-oauth',
      `width=${width},height=${height},left=${left},top=${top},popup=yes`
    );
  };

  // Fetch sellers
  const { data: sellers, isLoading } = useQuery({
    queryKey: ['ecommerce-sellers', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ecommerce_sellers')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Seller[];
    },
    enabled: !!tenantId,
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const { error } = await supabase
        .from('ecommerce_sellers')
        .update({ activo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecommerce-sellers'] });
      toast({ title: 'Estado actualizado' });
    },
    onError: () => {
      toast({ title: 'Error al actualizar', variant: 'destructive' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ecommerce_sellers')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecommerce-sellers'] });
      toast({ title: 'Seller eliminado' });
    },
    onError: () => {
      toast({ title: 'Error al eliminar', variant: 'destructive' });
    },
  });

  // Sync mutation for Tiendanube
  const syncMutation = useMutation({
    mutationFn: async (sellerId: string) => {
      setSyncingSellerId(sellerId);
      const { data, error } = await supabase.functions.invoke('tiendanube-sync', {
        body: { seller_id: sellerId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ecommerce-sellers'] });
      queryClient.invalidateQueries({ queryKey: ['ecommerce-orders'] });
      toast({ 
        title: 'Sincronización completada',
        description: `${data.created} nuevos, ${data.updated} actualizados, ${data.errors} errores`
      });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error al sincronizar', 
        description: error.message || 'Error desconocido',
        variant: 'destructive' 
      });
    },
    onSettled: () => {
      setSyncingSellerId(null);
    },
  });

  // Sync mutation for MercadoLibre
  const syncMLMutation = useMutation({
    mutationFn: async (sellerId: string) => {
      setSyncingSellerId(sellerId);
      const { data, error } = await supabase.functions.invoke('mercadolibre-sync', {
        body: { seller_id: sellerId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ecommerce-sellers'] });
      queryClient.invalidateQueries({ queryKey: ['ecommerce-orders'] });
      toast({ 
        title: 'Sincronización ML completada',
        description: `${data.created} nuevos, ${data.existing} existentes, ${data.errors} errores`
      });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error al sincronizar MercadoLibre', 
        description: error.message || 'Error desconocido',
        variant: 'destructive' 
      });
    },
    onSettled: () => {
      setSyncingSellerId(null);
    },
  });

  // Connect to Tiendanube
  const handleConnectTiendanube = (seller: Seller) => {
    const oauthUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tiendanube-oauth/authorize?seller_id=${seller.id}`;
    
    // Open popup for OAuth flow
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    window.open(
      oauthUrl,
      'tiendanube-oauth',
      `width=${width},height=${height},left=${left},top=${top},popup=yes`
    );
  };

  // Send connection link via Email or WhatsApp
  const handleSendConnectionLink = (seller: Seller, method: 'email' | 'whatsapp') => {
    // Determine URL and platform name based on seller platform
    let oauthUrl: string;
    let platformName: string;
    
    if (seller.plataforma === 'mercadolibre') {
      oauthUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadolibre-oauth/authorize?seller_id=${seller.id}`;
      platformName = 'MercadoLibre';
    } else {
      oauthUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tiendanube-oauth/authorize?seller_id=${seller.id}`;
      platformName = 'Tiendanube';
    }
    
    if (method === 'whatsapp') {
      if (!seller.telefono) {
        toast({ 
          title: 'Sin teléfono', 
          description: 'Este seller no tiene teléfono configurado',
          variant: 'destructive' 
        });
        return;
      }
      
      const cleanPhone = seller.telefono.replace(/\D/g, '');
      const message = `Hola ${seller.nombre} 👋

Para conectar tu cuenta de ${platformName} y sincronizar tus pedidos automáticamente, haz clic aquí:

${oauthUrl}

Solo toma unos segundos 🚀`;
      
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
      toast({ title: 'WhatsApp abierto', description: 'Envía el mensaje al seller' });
    } else {
      const subject = `Conecta tu cuenta de ${platformName}`;
      const body = `Hola ${seller.nombre},

Para sincronizar automáticamente tus pedidos de ${platformName}, necesitamos que autorices la conexión.

Haz clic en el siguiente enlace:
${oauthUrl}

Este proceso es seguro y solo toma unos segundos.

Saludos`;
      
      window.open(`mailto:${seller.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
      toast({ title: 'Email abierto', description: 'Envía el correo al seller' });
    }
  };

  const filteredSellers = sellers?.filter(s =>
    s.nombre.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  // Bulk sync all active connected sellers
  const handleBulkSync = async () => {
    const connectedSellers = sellers?.filter(s => s.activo && s.has_valid_token && s.store_id) || [];
    if (connectedSellers.length === 0) {
      toast({ title: 'Sin tiendas conectadas', description: 'No hay sellers activos con conexión para sincronizar', variant: 'destructive' });
      return;
    }

    setIsBulkSyncing(true);
    setBulkSyncProgress({ current: 0, total: connectedSellers.length, currentName: '' });
    let totalCreated = 0, totalUpdated = 0, totalErrors = 0, totalExisting = 0;

    for (let i = 0; i < connectedSellers.length; i++) {
      const seller = connectedSellers[i];
      setBulkSyncProgress({ current: i + 1, total: connectedSellers.length, currentName: seller.nombre });
      
      try {
        const fnName = seller.plataforma === 'mercadolibre' ? 'mercadolibre-sync' : 'tiendanube-sync';
        const { data, error } = await supabase.functions.invoke(fnName, {
          body: { seller_id: seller.id },
        });
        if (error) throw error;
        totalCreated += data?.created || 0;
        totalUpdated += data?.updated || 0;
        totalExisting += data?.existing || 0;
        totalErrors += data?.errors || 0;
      } catch (e: any) {
        console.error(`Error syncing ${seller.nombre}:`, e);
        totalErrors++;
      }
    }

    setIsBulkSyncing(false);
    queryClient.invalidateQueries({ queryKey: ['ecommerce-sellers'] });
    queryClient.invalidateQueries({ queryKey: ['ecommerce-orders'] });
    toast({
      title: 'Sincronización masiva completada',
      description: `${connectedSellers.length} tiendas · ${totalCreated} nuevos · ${totalUpdated + totalExisting} actualizados · ${totalErrors} errores`,
    });
  };

  // Link seller to client logic
  const linkSellerToClient = async (seller: Seller): Promise<string | null> => {
    if (seller.cliente_id) return seller.cliente_id;
    
    // Search by email
    let clientId: string | null = null;
    if (seller.email) {
      const { data: byEmail } = await supabase
        .from('clientes')
        .select('id')
        .eq('tenant_id', tenantId!)
        .eq('email', seller.email)
        .limit(1)
        .maybeSingle();
      if (byEmail) clientId = byEmail.id;
    }
    
    // Search by phone
    if (!clientId && seller.telefono) {
      const { data: byPhone } = await supabase
        .from('clientes')
        .select('id')
        .eq('tenant_id', tenantId!)
        .eq('telefono', seller.telefono)
        .limit(1)
        .maybeSingle();
      if (byPhone) clientId = byPhone.id;
    }
    
    // Create new client if not found
    if (!clientId) {
      const { data: newClient, error } = await supabase
        .from('clientes')
        .insert({
          nombre: seller.nombre,
          email: seller.email,
          telefono: seller.telefono || '',
          direccion: seller.direccion || 'Sin dirección',
          ciudad: seller.ciudad || null,
          tenant_id: tenantId!,
        })
        .select('id')
        .single();
      if (error) throw error;
      clientId = newClient.id;
    }
    
    // Update seller
    const { error: updateError } = await supabase
      .from('ecommerce_sellers')
      .update({ cliente_id: clientId })
      .eq('id', seller.id);
    if (updateError) throw updateError;
    
    return clientId;
  };

  // Individual link
  const handleLinkSeller = async (seller: Seller) => {
    setIsLinkingSellerId(seller.id);
    try {
      await linkSellerToClient(seller);
      queryClient.invalidateQueries({ queryKey: ['ecommerce-sellers'] });
      toast({ title: 'Seller vinculado', description: `${seller.nombre} fue vinculado a un cliente exitosamente` });
    } catch (e: any) {
      toast({ title: 'Error al vincular', description: e.message, variant: 'destructive' });
    } finally {
      setIsLinkingSellerId(null);
    }
  };

  // Bulk link
  const handleBulkLink = async () => {
    const unlinked = sellers?.filter(s => !s.cliente_id) || [];
    if (unlinked.length === 0) {
      toast({ title: 'Todos vinculados', description: 'Todos los sellers ya tienen un cliente asignado' });
      return;
    }
    
    setIsBulkLinking(true);
    setBulkLinkProgress({ current: 0, total: unlinked.length, currentName: '' });
    let linked = 0, errors = 0;
    
    for (let i = 0; i < unlinked.length; i++) {
      const seller = unlinked[i];
      setBulkLinkProgress({ current: i + 1, total: unlinked.length, currentName: seller.nombre });
      try {
        await linkSellerToClient(seller);
        linked++;
      } catch (e) {
        console.error(`Error linking ${seller.nombre}:`, e);
        errors++;
      }
    }
    
    setIsBulkLinking(false);
    queryClient.invalidateQueries({ queryKey: ['ecommerce-sellers'] });
    toast({
      title: 'Vinculación masiva completada',
      description: `${linked} vinculados, ${errors} errores`,
    });
  };

  // Stats
  const stats = {
    total: sellers?.length || 0,
    activos: sellers?.filter(s => s.activo).length || 0,
    conCtaCte: sellers?.filter(s => s.tiene_cuenta_corriente).length || 0,
    saldoTotal: sellers?.reduce((acc, s) => acc + (s.saldo_cuenta_corriente || 0), 0) || 0,
  };

  // Check if seller is connected
  const isConnected = (seller: Seller) => !!seller.access_token && !!seller.store_id;

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sellers e-Commerce</h1>
          <p className="text-muted-foreground">Gestiona las tiendas online conectadas</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={handleBulkLink}
            disabled={isBulkLinking}
          >
            {isBulkLinking ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LinkIcon className="mr-2 h-4 w-4" />
            )}
            {isBulkLinking
              ? `Vinculando ${bulkLinkProgress.current}/${bulkLinkProgress.total}...`
              : 'Vincular Todos'
            }
          </Button>
          <Button
            variant="outline"
            onClick={handleBulkSync}
            disabled={isBulkSyncing}
          >
            {isBulkSyncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            {isBulkSyncing 
              ? `Sincronizando ${bulkSyncProgress.current}/${bulkSyncProgress.total}...`
              : 'Sincronizar Todas'
            }
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar Seller
          </Button>
        </div>
      </div>

      {/* Bulk sync progress */}
      {isBulkSyncing && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Sincronizando: <strong>{bulkSyncProgress.currentName}</strong></span>
              <span className="text-muted-foreground">{bulkSyncProgress.current}/{bulkSyncProgress.total}</span>
            </div>
            <Progress value={(bulkSyncProgress.current / bulkSyncProgress.total) * 100} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Bulk link progress */}
      {isBulkLinking && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Vinculando: <strong>{bulkLinkProgress.currentName}</strong></span>
              <span className="text-muted-foreground">{bulkLinkProgress.current}/{bulkLinkProgress.total}</span>
            </div>
            <Progress value={(bulkLinkProgress.current / bulkLinkProgress.total) * 100} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Store className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Sellers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activos}</p>
                <p className="text-xs text-muted-foreground">Activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.conCtaCte}</p>
                <p className="text-xs text-muted-foreground">Con Cta. Cte.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <DollarSign className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">${stats.saldoTotal.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Saldo Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar seller..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seller</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Conexión</TableHead>
                  <TableHead>Acceso</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Último Sync</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSellers?.map((seller) => (
                  <TableRow key={seller.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{seller.nombre}</span>
                          {(seller as any).es_cuenta_logistica && (
                            <Badge variant="outline" className="text-[10px] border-blue-500 text-blue-600 dark:text-blue-400">
                              Logística
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{seller.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={PLATAFORMA_LABELS[seller.plataforma]?.color || 'bg-gray-500'}>
                        {PLATAFORMA_LABELS[seller.plataforma]?.label || seller.plataforma}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {seller.cliente_id ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-xs text-green-600 dark:text-green-400">Vinculado</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-orange-500" />
                          <span className="text-xs text-orange-600 dark:text-orange-400">Sin vincular</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {seller.plataforma === 'tiendanube' ? (
                        isConnected(seller) ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-xs text-green-600 dark:text-green-400">Conectado</span>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleConnectTiendanube(seller)}
                          >
                            <Link2 className="mr-1 h-3 w-3" />
                            Conectar
                          </Button>
                        )
                      ) : seller.plataforma === 'mercadolibre' ? (
                        isConnected(seller) ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-xs text-green-600 dark:text-green-400">Conectado</span>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-yellow-50 hover:bg-yellow-100 border-yellow-300"
                            onClick={() => handleConnectMercadoLibre(seller)}
                          >
                            <Link2 className="mr-1 h-3 w-3" />
                            Conectar ML
                          </Button>
                        )
                      ) : seller.plataforma === 'manual' ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Link2 className="mr-1 h-3 w-3" />
                              Conectar
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={async () => {
                              await supabase.from('ecommerce_sellers').update({ plataforma: 'mercadolibre' }).eq('id', seller.id);
                              queryClient.invalidateQueries({ queryKey: ['ecommerce-sellers'] });
                              handleConnectMercadoLibre({ ...seller, plataforma: 'mercadolibre' });
                            }}>
                              Conectar MercadoLibre
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={async () => {
                              await supabase.from('ecommerce_sellers').update({ plataforma: 'tiendanube' }).eq('id', seller.id);
                              queryClient.invalidateQueries({ queryKey: ['ecommerce-sellers'] });
                              handleConnectTiendanube({ ...seller, plataforma: 'tiendanube' });
                            }}>
                              Conectar Tiendanube
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Pendiente</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {seller.user_id ? (
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-green-500" />
                          <span className="text-xs text-green-600 dark:text-green-400">Vinculado</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <UserX className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Sin acceso</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={seller.activo ? 'default' : 'secondary'}>
                        {seller.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${seller.saldo_cuenta_corriente?.toLocaleString() || '0'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {seller.ultimo_sync 
                        ? format(new Date(seller.ultimo_sync), 'dd/MM/yy HH:mm', { locale: es })
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedSeller(seller);
                            setDetailsOpen(true);
                          }}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver Detalles
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setSelectedSeller(seller);
                            setEditOpen(true);
                          }}>
                            <Settings className="mr-2 h-4 w-4" />
                            Configurar
                          </DropdownMenuItem>
                          
                          {seller.plataforma === 'tiendanube' && isConnected(seller) && (
                            <DropdownMenuItem 
                              onClick={() => syncMutation.mutate(seller.id)}
                              disabled={syncingSellerId === seller.id}
                            >
                              {syncingSellerId === seller.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="mr-2 h-4 w-4" />
                              )}
                              Sincronizar Ahora
                            </DropdownMenuItem>
                          )}
                          
                          {seller.plataforma === 'tiendanube' && !isConnected(seller) && (
                            <>
                              <DropdownMenuItem onClick={() => handleConnectTiendanube(seller)}>
                                <Link2 className="mr-2 h-4 w-4" />
                                Conectar Tiendanube
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleSendConnectionLink(seller, 'email')}>
                                <Mail className="mr-2 h-4 w-4" />
                                Enviar link por Email
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleSendConnectionLink(seller, 'whatsapp')}>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Enviar link por WhatsApp
                              </DropdownMenuItem>
                            </>
                          )}
                          
                          {seller.plataforma === 'mercadolibre' && isConnected(seller) && (
                            <DropdownMenuItem 
                              onClick={() => syncMLMutation.mutate(seller.id)}
                              disabled={syncingSellerId === seller.id}
                            >
                              {syncingSellerId === seller.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="mr-2 h-4 w-4" />
                              )}
                              Sincronizar Ahora
                            </DropdownMenuItem>
                          )}
                          
                          {seller.plataforma === 'mercadolibre' && !isConnected(seller) && (
                            <>
                              <DropdownMenuItem onClick={() => handleConnectMercadoLibre(seller)}>
                                <Link2 className="mr-2 h-4 w-4" />
                                Conectar MercadoLibre
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleSendConnectionLink(seller, 'email')}>
                                <Mail className="mr-2 h-4 w-4" />
                                Enviar link por Email
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleSendConnectionLink(seller, 'whatsapp')}>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Enviar link por WhatsApp
                              </DropdownMenuItem>
                            </>
                          )}
                          
                          <DropdownMenuSeparator />
                          
                          {!seller.cliente_id && (
                            <DropdownMenuItem
                              onClick={() => handleLinkSeller(seller)}
                              disabled={isLinkingSellerId === seller.id}
                            >
                              {isLinkingSellerId === seller.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <LinkIcon className="mr-2 h-4 w-4" />
                              )}
                              Vincular Cliente
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuItem
                            onClick={() => toggleActiveMutation.mutate({ id: seller.id, activo: !seller.activo })}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            {seller.activo ? 'Desactivar' : 'Activar'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (confirm('¿Eliminar este seller?')) {
                                deleteMutation.mutate(seller.id);
                              }
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredSellers?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No hay sellers registrados
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateSellerDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['ecommerce-sellers'] });
          setCreateDialogOpen(false);
        }}
      />
      
      {selectedSeller && (
        <>
          <SellerDetailsDialog
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
            seller={selectedSeller}
          />
          <EditSellerDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            seller={selectedSeller}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['ecommerce-sellers'] });
              setEditOpen(false);
            }}
          />
        </>
      )}
    </div>
  );
}

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: {
    id: string;
    nombre: string;
    usuarios_count: number;
    sucursales_count: number;
  };
  onSuccess: () => void;
}

export function DeleteTenantDialog({
  open,
  onOpenChange,
  tenant,
  onSuccess,
}: DeleteTenantDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const canDelete = confirmText === tenant.nombre;

  const handleDelete = async () => {
    if (!canDelete) return;

    setIsDeleting(true);
    try {
      // Get all related IDs first
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('tenant_id', tenant.id);
      const userIds = profiles?.map(p => p.user_id) || [];

      const { data: sucursales } = await supabase
        .from('sucursales')
        .select('id')
        .eq('tenant_id', tenant.id);
      const sucursalIds = sucursales?.map(s => s.id) || [];

      const { data: rutas } = await supabase
        .from('rutas_planificadas')
        .select('id')
        .eq('tenant_id', tenant.id);
      const rutaIds = rutas?.map(r => r.id) || [];

      const { data: hojas } = await supabase
        .from('hojas_ruta')
        .select('id')
        .eq('tenant_id', tenant.id);
      const hojaIds = hojas?.map(h => h.id) || [];

      const { data: envios } = await supabase
        .from('envios')
        .select('id')
        .eq('tenant_id', tenant.id);
      const envioIds = envios?.map(e => e.id) || [];

      const { data: clientes } = await supabase
        .from('clientes')
        .select('id')
        .eq('tenant_id', tenant.id);
      const clienteIds = clientes?.map(c => c.id) || [];

      const { data: tarifas } = await supabase
        .from('tarifas')
        .select('id')
        .eq('tenant_id', tenant.id);
      const tarifaIds = tarifas?.map(t => t.id) || [];

      const { data: sellers } = await supabase
        .from('ecommerce_sellers')
        .select('id')
        .eq('tenant_id', tenant.id);
      const sellerIds = sellers?.map(s => s.id) || [];

      const { data: rutasFrecuentes } = await supabase
        .from('rutas_frecuentes')
        .select('id')
        .eq('tenant_id', tenant.id);
      const rutaFrecuenteIds = rutasFrecuentes?.map(r => r.id) || [];

      // Delete in order to respect foreign key constraints
      
      // 1. Delete tenant branding
      await supabase.from('tenant_branding').delete().eq('tenant_id', tenant.id);

      // 2. Delete driver location history (references chofer_id which is user_id)
      if (userIds.length > 0) {
        await supabase.from('driver_location_history').delete().in('chofer_id', userIds);
      }

      // 3. Delete route stops (ruta_paradas) via rutas_planificadas
      if (rutaIds.length > 0) {
        await supabase.from('ruta_paradas').delete().in('ruta_id', rutaIds);
      }

      // 4. Nullify sucursal references in rutas_planificadas before deleting
      await supabase.from('rutas_planificadas')
        .update({ sucursal_id: null } as any)
        .eq('tenant_id', tenant.id);

      // 5. Delete planned routes
      await supabase.from('rutas_planificadas').delete().eq('tenant_id', tenant.id);

      // 6. Delete frequent route stops
      if (rutaFrecuenteIds.length > 0) {
        await supabase.from('ruta_frecuente_paradas').delete().in('ruta_frecuente_id', rutaFrecuenteIds);
      }

      // 7. Nullify sucursal references in rutas_frecuentes before deleting
      await supabase.from('rutas_frecuentes')
        .update({ sucursal_id: null } as any)
        .eq('tenant_id', tenant.id);

      // 8. Delete frequent routes
      await supabase.from('rutas_frecuentes').delete().eq('tenant_id', tenant.id);

      // 9. Delete route sheet shipments (hoja_ruta_envios) via hojas_ruta
      if (hojaIds.length > 0) {
        await supabase.from('hoja_ruta_envios').delete().in('hoja_ruta_id', hojaIds);
      }

      // 10. Nullify sucursal references in hojas_ruta before deleting
      await supabase.from('hojas_ruta')
        .update({ sucursal_origen_id: null, sucursal_destino_id: null } as any)
        .eq('tenant_id', tenant.id);

      // 11. Delete route sheets
      await supabase.from('hojas_ruta').delete().eq('tenant_id', tenant.id);

      // 12. Delete ecommerce_orders (references envio_id and seller_id)
      await supabase.from('ecommerce_orders').delete().eq('tenant_id', tenant.id);

      // 13. Delete seller account movements
      if (sellerIds.length > 0) {
        await supabase.from('seller_cuenta_corriente').delete().in('seller_id', sellerIds);
        await supabase.from('liquidaciones_seller').delete().in('seller_id', sellerIds);
      }

      // 14. Nullify sucursal_pickup_id in ecommerce_sellers before deleting
      await supabase.from('ecommerce_sellers')
        .update({ sucursal_pickup_id: null } as any)
        .eq('tenant_id', tenant.id);

      // 15. Delete ecommerce sellers
      await supabase.from('ecommerce_sellers').delete().eq('tenant_id', tenant.id);

      // 16. Delete shipment details and history
      if (envioIds.length > 0) {
        await supabase.from('envio_detalles').delete().in('envio_id', envioIds);
        await supabase.from('envio_historial').delete().in('envio_id', envioIds);
      }

      // 17. Delete commissions and settlements
      await supabase.from('comisiones').delete().eq('tenant_id', tenant.id);
      await supabase.from('liquidaciones').delete().eq('tenant_id', tenant.id);
      await supabase.from('liquidaciones_sucursal').delete().eq('tenant_id', tenant.id);

      // 18. Delete payments and invoices
      await supabase.from('pagos').delete().eq('tenant_id', tenant.id);
      await supabase.from('facturas').delete().eq('tenant_id', tenant.id);

      // 19. Nullify sucursal references in envios before deleting
      await supabase.from('envios')
        .update({ 
          sucursal_origen_id: null, 
          sucursal_destino_id: null, 
          sucursal_entrega_id: null, 
          sucursal_retiro_id: null 
        } as any)
        .eq('tenant_id', tenant.id);

      // 20. Delete shipments
      await supabase.from('envios').delete().eq('tenant_id', tenant.id);

      // 21. Delete incidents
      await supabase.from('incidentes').delete().eq('tenant_id', tenant.id);

      // 22. Delete notifications
      await supabase.from('notifications').delete().eq('tenant_id', tenant.id);

      // 23. Delete ARCA config
      await supabase.from('arca_config').delete().eq('tenant_id', tenant.id);

      // 24. Delete insurance config
      await supabase.from('configuracion_seguro').delete().eq('tenant_id', tenant.id);

      // 25. Delete cash sessions and movements
      if (sucursalIds.length > 0) {
        const { data: sesiones } = await supabase
          .from('sesiones_caja')
          .select('id')
          .in('sucursal_id', sucursalIds);
        
        if (sesiones && sesiones.length > 0) {
          const sesionIds = sesiones.map(s => s.id);
          await supabase.from('movimientos_caja').delete().in('sesion_caja_id', sesionIds);
        }
        await supabase.from('sesiones_caja').delete().in('sucursal_id', sucursalIds);
      }

      // 26. Nullify sucursal_id in clientes before deleting
      await supabase.from('clientes')
        .update({ sucursal_id: null } as any)
        .eq('tenant_id', tenant.id);

      // 27. Delete client settlements and accounts
      if (clienteIds.length > 0) {
        await supabase.from('cliente_cuenta_corriente').delete().in('cliente_id', clienteIds);
        await supabase.from('liquidaciones_cliente').delete().in('cliente_id', clienteIds);
      }

      // 28. Delete clients
      await supabase.from('clientes').delete().eq('tenant_id', tenant.id);

      // 29. Delete tarifa concepts (tarifa_concepto_precios will be handled by cascade)
      await supabase.from('tarifa_conceptos').delete().eq('tenant_id', tenant.id);

      // 30. Delete sucursal_tarifas, sucursal_conceptos, sucursal_comisiones, sucursal_zonas
      for (const sucursalId of sucursalIds) {
        await supabase.from('sucursal_tarifas').delete().eq('sucursal_id', sucursalId);
        await supabase.from('sucursal_conceptos').delete().eq('sucursal_id', sucursalId);
        await supabase.from('sucursal_comisiones').delete().eq('sucursal_id', sucursalId);
        await supabase.from('sucursal_zonas').delete().eq('sucursal_id', sucursalId);
      }

      // 31. Delete tarifas
      await supabase.from('tarifas').delete().eq('tenant_id', tenant.id);

      // 32. Delete historial ajustes tarifas
      await supabase.from('historial_ajustes_tarifas').delete().eq('tenant_id', tenant.id);

      // 33. Delete transferencias that reference sucursales (filter by sucursal IDs)
      if (sucursalIds.length > 0) {
        await supabase.from('transferencias').delete().in('sucursal_origen_id', sucursalIds);
        await supabase.from('transferencias').delete().in('sucursal_destino_id', sucursalIds);
      }

      // 34. Nullify centro_logistico_id (self-reference) in sucursales
      await supabase.from('sucursales')
        .update({ centro_logistico_id: null } as any)
        .eq('tenant_id', tenant.id);

      // 35. Nullify sucursal_id in vehiculos before deleting sucursales
      await supabase.from('vehiculos')
        .update({ sucursal_id: null } as any)
        .eq('tenant_id', tenant.id);

      // 36. Nullify sucursal_id in profiles before deleting sucursales
      await supabase.from('profiles')
        .update({ sucursal_id: null } as any)
        .eq('tenant_id', tenant.id);

      // 37. Delete branches (after all FK references nullified)
      await supabase.from('sucursales').delete().eq('tenant_id', tenant.id);

      // 38. Delete vehicles
      await supabase.from('vehiculos').delete().eq('tenant_id', tenant.id);

      // 29. Delete third party companies
      await supabase.from('empresas_terciarizadas').delete().eq('tenant_id', tenant.id);

      // 30. Delete system integrations
      await supabase.from('system_integrations').delete().eq('tenant_id', tenant.id);

      // 31. Delete tenant API keys
      await supabase.from('tenant_api_keys').delete().eq('tenant_id', tenant.id);

      // 32. Delete tenant subscriptions
      await supabase.from('tenant_subscriptions').delete().eq('tenant_id', tenant.id);

      // 33. Delete tenant usage
      await supabase.from('tenant_usage').delete().eq('tenant_id', tenant.id);

      // 34. Delete user roles and driver locations
      if (userIds.length > 0) {
        await supabase.from('user_roles').delete().in('user_id', userIds);
        await supabase.from('driver_locations').delete().in('chofer_id', userIds);
      }

      // 35. Delete profiles
      await supabase.from('profiles').delete().eq('tenant_id', tenant.id);

      // 36. Finally delete the tenant
      const { error: tenantError } = await supabase
        .from('tenants')
        .delete()
        .eq('id', tenant.id);

      if (tenantError) throw tenantError;

      toast.success('Empresa eliminada correctamente');
      setConfirmText('');
      onSuccess();
    } catch (error: any) {
      console.error('Error deleting tenant:', error);
      toast.error(`Error al eliminar: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isDeleting) {
      setConfirmText('');
      onOpenChange(newOpen);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>Eliminar Empresa</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2 space-y-3">
            <p>
              Estás a punto de eliminar permanentemente la empresa{' '}
              <strong className="text-foreground">{tenant.nombre}</strong>.
            </p>
            <div className="rounded-lg bg-destructive/10 p-3 text-sm">
              <p className="font-medium text-destructive">Esta acción eliminará:</p>
              <ul className="mt-2 list-disc pl-5 space-y-1 text-muted-foreground">
                <li>{tenant.usuarios_count} usuario(s)</li>
                <li>{tenant.sucursales_count} sucursal(es)</li>
                <li>Todos los envíos, rutas y datos relacionados</li>
                <li>Configuración y facturación</li>
              </ul>
            </div>
            <p className="text-sm">
              Para confirmar, escribe{' '}
              <strong className="text-foreground">{tenant.nombre}</strong> en el campo de abajo:
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-2">
          <Label htmlFor="confirm-name" className="sr-only">
            Nombre de la empresa
          </Label>
          <Input
            id="confirm-name"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Escribe el nombre de la empresa"
            disabled={isDeleting}
          />
        </div>

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Eliminando...
              </>
            ) : (
              'Eliminar empresa'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, MapPin, User, Truck, Package, Home, Calendar, Clock, Building2 } from 'lucide-react';
import { parseDateString } from '@/lib/dateUtils';

export default function PrintPlannedRoute() {
  const [searchParams] = useSearchParams();
  const routeId = searchParams.get('id');

  // Fetch route details
  const { data: ruta, isLoading } = useQuery({
    queryKey: ['print-planned-route', routeId],
    queryFn: async () => {
      if (!routeId) return null;

      const { data: rutaData, error: rutaError } = await supabase
        .from('rutas_planificadas')
        .select(`
          *,
          sucursal:sucursales(nombre, direccion, ciudad, telefono),
          vehiculo:vehiculos(patente, marca, modelo)
        `)
        .eq('id', routeId)
        .single();

      if (rutaError) throw rutaError;

      // Fetch driver profile
      let choferProfile = null;
      if (rutaData.chofer_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nombre, apellido, telefono')
          .eq('user_id', rutaData.chofer_id)
          .single();
        choferProfile = profile;
      }

      // Fetch stops with shipment details
      const { data: paradas, error: paradasError } = await supabase
        .from('ruta_paradas')
        .select(`
          *,
        envio:envios(
            tracking_number,
            direccion_entrega,
            direccion_retiro,
            ciudad_entrega,
            ciudad_retiro,
            precio_total,
            tipo_pago,
            pago_contra_entrega,
            descripcion,
            notas,
            cantidad_bultos,
            nombre_destinatario,
            nombre_remitente,
            destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido, telefono, direccion),
            remitente:clientes!envios_remitente_id_fkey(nombre, apellido, telefono, direccion)
          )
        `)
        .eq('ruta_id', routeId)
        .order('orden', { ascending: true });

      if (paradasError) throw paradasError;

      return {
        ...rutaData,
        chofer_profile: choferProfile,
        paradas: paradas || [],
      };
    },
    enabled: !!routeId,
  });

  // Auto print when loaded
  useEffect(() => {
    if (ruta && !isLoading) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [ruta, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!ruta) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Ruta no encontrada</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 print:p-2">
      <style>{`
        @media print {
          @page { 
            size: A4; 
            margin: 10mm;
          }
          body { 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      {/* Header */}
      <div className="border-2 border-black p-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">HOJA DE RUTA</h1>
            <p className="text-xl font-mono mt-1">{ruta.numero}</p>
          </div>
          <div className="text-right">
            <QRCodeSVG value={`RP:${ruta.id}`} size={80} />
          </div>
        </div>
      </div>

      {/* Route Info Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Left Column - Route Details */}
        <div className="border border-black p-3">
          <h2 className="font-bold text-sm border-b border-black pb-1 mb-2 flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            DATOS DE LA RUTA
          </h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">Fecha:</span>
              <span>{format(parseDateString(ruta.fecha), "EEEE dd/MM/yyyy", { locale: es })}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Hora inicio:</span>
              <span>{ruta.hora_inicio || 'No especificada'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Tipo:</span>
              <span className="capitalize">{ruta.tipo || 'Mixta'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Total paradas:</span>
              <span>{ruta.total_paradas}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Distancia est.:</span>
              <span>{ruta.distancia_total_km} km</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Tiempo est.:</span>
              <span>{ruta.tiempo_estimado_minutos ? `${Math.floor(ruta.tiempo_estimado_minutos / 60)}h ${ruta.tiempo_estimado_minutos % 60}m` : '-'}</span>
            </div>
          </div>
        </div>

        {/* Right Column - Driver & Vehicle */}
        <div className="border border-black p-3">
          <h2 className="font-bold text-sm border-b border-black pb-1 mb-2 flex items-center gap-1">
            <User className="h-4 w-4" />
            CHOFER Y VEHÍCULO
          </h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">Chofer:</span>
              <span>{ruta.chofer_profile ? `${ruta.chofer_profile.nombre} ${ruta.chofer_profile.apellido || ''}` : 'No asignado'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Teléfono:</span>
              <span>{ruta.chofer_profile?.telefono || '-'}</span>
            </div>
            {ruta.vehiculo && (
              <>
                <div className="flex justify-between">
                  <span className="font-medium">Vehículo:</span>
                  <span>{ruta.vehiculo.marca} {ruta.vehiculo.modelo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Patente:</span>
                  <span className="font-mono">{ruta.vehiculo.patente}</span>
                </div>
              </>
            )}
          </div>
          
          <div className="mt-3 pt-2 border-t border-gray-300">
            <h3 className="font-bold text-xs mb-1">Sucursal Origen:</h3>
            <p className="text-sm">{ruta.sucursal?.nombre}</p>
            <p className="text-xs text-gray-600">{ruta.sucursal?.direccion}</p>
          </div>
        </div>
      </div>

      {/* Stops List */}
      <div className="border border-black">
        <h2 className="font-bold text-sm bg-black text-white p-2 flex items-center gap-1">
          <MapPin className="h-4 w-4" />
          PARADAS ({ruta.paradas.length})
        </h2>
        
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black bg-gray-100">
              <th className="p-2 text-left w-8">#</th>
              <th className="p-2 text-left w-12">Tipo</th>
              <th className="p-2 text-left">Tracking</th>
              <th className="p-2 text-left">Cliente</th>
              <th className="p-2 text-left">Dirección</th>
              <th className="p-2 text-left w-20">Teléfono</th>
              <th className="p-2 text-center w-16">COD</th>
              <th className="p-2 text-center w-10">✓</th>
            </tr>
          </thead>
          <tbody>
            {ruta.paradas.map((parada: any, index: number) => {
              const envio = parada.envio;
              const isSucursalStop = !parada.envio_id && !!parada.sucursal_id;
              
              if (isSucursalStop) {
                return (
                  <tr key={parada.id} className={`border-b ${index % 2 === 1 ? 'bg-gray-50' : ''}`}>
                    <td className="p-2 font-bold">{index + 1}</td>
                    <td className="p-2">
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                        <Building2 className="h-3 w-3" />S
                      </span>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">-</td>
                    <td className="p-2">
                      <div className="font-medium">{parada.nombre_parada || 'Sucursal'}</div>
                    </td>
                    <td className="p-2">{parada.direccion || '-'}</td>
                    <td className="p-2 text-xs">-</td>
                    <td className="p-2 text-center"></td>
                    <td className="p-2 text-center">
                      <div className="w-5 h-5 border-2 border-black mx-auto"></div>
                    </td>
                  </tr>
                );
              }

              const isRetiro = parada.tipo === 'retiro';
              const cliente = isRetiro ? envio?.remitente : envio?.destinatario;
              const clienteName = isRetiro 
                ? (envio?.nombre_remitente || `${cliente?.nombre || ''} ${cliente?.apellido || ''}`.trim())
                : (envio?.nombre_destinatario || `${cliente?.nombre || ''} ${cliente?.apellido || ''}`.trim());
              const direccion = isRetiro 
                ? (envio?.direccion_retiro || cliente?.direccion)
                : (envio?.direccion_entrega || cliente?.direccion);
              const ciudad = isRetiro ? envio?.ciudad_retiro : envio?.ciudad_entrega;
              const isCOD = envio?.pago_contra_entrega && envio?.tipo_pago === 'contra_entrega';

              return (
                <React.Fragment key={parada.id}>
                  <tr className={`border-b ${index % 2 === 1 ? 'bg-gray-50' : ''}`}>
                    <td className="p-2 font-bold">{index + 1}</td>
                    <td className="p-2">
                      {isRetiro ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-100 px-1.5 py-0.5 rounded">
                          <Home className="h-3 w-3" />R
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-100 px-1.5 py-0.5 rounded">
                          <Package className="h-3 w-3" />E
                        </span>
                      )}
                    </td>
                    <td className="p-2 font-mono text-xs">{envio?.tracking_number}</td>
                    <td className="p-2">
                      <div className="font-medium">{clienteName}</div>
                      {envio?.cantidad_bultos && (
                        <div className="text-xs text-gray-500">{envio.cantidad_bultos} bulto(s)</div>
                      )}
                    </td>
                    <td className="p-2">
                      <div>{direccion}</div>
                      {ciudad && <div className="text-xs text-gray-500">{ciudad}</div>}
                    </td>
                    <td className="p-2 text-xs">{cliente?.telefono || '-'}</td>
                    <td className="p-2 text-center">
                      {isCOD && (
                        <span className="inline-block bg-yellow-200 text-yellow-800 text-xs font-bold px-1.5 py-0.5 rounded">
                          ${envio?.precio_total}
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      <div className="w-5 h-5 border-2 border-black mx-auto"></div>
                    </td>
                  </tr>
                  {envio?.notas && (
                    <tr className="bg-amber-50 border-b">
                      <td></td>
                      <td colSpan={7} className="px-2 py-1 text-xs italic text-amber-800">
                        📝 {envio.notas}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary & Signature Section */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="border border-black p-3">
          <h2 className="font-bold text-sm border-b border-black pb-1 mb-2">RESUMEN</h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Total Retiros:</span>
              <span className="font-bold">{ruta.paradas.filter((p: any) => p.tipo === 'retiro').length}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Entregas:</span>
              <span className="font-bold">{ruta.paradas.filter((p: any) => p.tipo === 'entrega').length}</span>
            </div>
            {ruta.paradas.filter((p: any) => p.tipo === 'sucursal' || (!p.envio_id && p.sucursal_id)).length > 0 && (
              <div className="flex justify-between">
                <span>Sucursales:</span>
                <span className="font-bold">{ruta.paradas.filter((p: any) => p.tipo === 'sucursal' || (!p.envio_id && p.sucursal_id)).length}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1 mt-2">
              <span>Cobros COD:</span>
              <span className="font-bold">
                ${ruta.paradas
                  .filter((p: any) => p.envio?.pago_contra_entrega && p.envio?.tipo_pago === 'contra_entrega')
                  .reduce((acc: number, p: any) => acc + (p.envio?.precio_total || 0), 0)
                  .toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="border border-black p-3">
          <h2 className="font-bold text-sm border-b border-black pb-1 mb-2">FIRMA DEL CHOFER</h2>
          <div className="h-20 border-b border-dashed border-gray-400 mb-2"></div>
          <p className="text-xs text-center text-gray-600">
            Firma y aclaración
          </p>
        </div>
      </div>

      {/* Notes */}
      {ruta.notas && (
        <div className="border border-black p-3 mt-4">
          <h2 className="font-bold text-sm border-b border-black pb-1 mb-2">NOTAS</h2>
          <p className="text-sm">{ruta.notas}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-2 border-t text-center text-xs text-gray-500">
        <p>Generado el {format(new Date(), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}</p>
      </div>

      {/* Print Button (hidden when printing) */}
      <div className="no-print fixed bottom-4 right-4 flex gap-2">
        <button
          onClick={() => window.print()}
          className="bg-primary text-white px-4 py-2 rounded-lg shadow-lg hover:bg-primary/90"
        >
          Imprimir
        </button>
        <button
          onClick={() => window.close()}
          className="bg-gray-500 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-gray-600"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";
import { parseDateString } from "@/lib/dateUtils";

export default function PrintRouteSheet() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hojaRutaId = searchParams.get("id");

  const { data: hojaRuta, isLoading, error } = useQuery({
    queryKey: ["hoja-ruta-print", hojaRutaId],
    queryFn: async () => {
      if (!hojaRutaId) throw new Error("ID no proporcionado");

      const { data, error } = await supabase
        .from("hojas_ruta")
        .select(`
          *,
          sucursal_origen:sucursales!hojas_ruta_sucursal_origen_id_fkey(id, nombre, direccion, ciudad, telefono),
          sucursal_destino:sucursales!hojas_ruta_sucursal_destino_id_fkey(id, nombre, direccion, ciudad, telefono)
        `)
        .eq("id", hojaRutaId)
        .single();

      if (error) throw error;

      // Fetch envíos relacionados
      const { data: enviosData, error: enviosError } = await supabase
        .from("hoja_ruta_envios")
        .select(`
          *,
          envio:envios(
            id,
            tracking_number,
            cantidad_bultos,
            peso_kg,
            descripcion,
            nombre_destinatario,
            destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido, direccion, ciudad)
          )
        `)
        .eq("hoja_ruta_id", hojaRutaId)
        .order("orden");

      if (enviosError) throw enviosError;

      // Fetch chofer profile if assigned
      let choferProfile = null;
      if (data.chofer_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("nombre, apellido")
          .eq("user_id", data.chofer_id)
          .single();
        choferProfile = profile;
      }

      // Fetch vehicle if assigned
      let vehiculo = null;
      if (data.vehiculo_id) {
        const { data: veh } = await supabase
          .from("vehiculos")
          .select("patente, marca, modelo")
          .eq("id", data.vehiculo_id)
          .single();
        vehiculo = veh;
      }

      return {
        ...data,
        envios: enviosData?.map(e => e.envio) || [],
        choferProfile,
        vehiculo,
      };
    },
    enabled: !!hojaRutaId,
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !hojaRuta) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive">Error al cargar la hoja de ruta</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
      </div>
    );
  }

  const totalBultos = hojaRuta.envios?.reduce((acc: number, e: any) => acc + (e?.cantidad_bultos || 1), 0) || 0;
  const totalPeso = hojaRuta.envios?.reduce((acc: number, e: any) => acc + (e?.peso_kg || 0), 0) || 0;

  // QR content: HR:{id} for mass receiving
  const qrContent = `HR:${hojaRuta.id}`;

  return (
    <>
      {/* Header no imprimible */}
      <div className="print:hidden bg-background border-b p-4 flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <Button onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimir
        </Button>
      </div>

      {/* Contenido imprimible */}
      <div className="print-content bg-white text-black p-8 max-w-4xl mx-auto">
        {/* Encabezado */}
        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">HOJA DE RUTA</h1>
            <p className="text-2xl font-mono mt-2">{hojaRuta.numero}</p>
            <p className="text-sm text-gray-600 mt-1">
              Fecha: {format(parseDateString(hojaRuta.created_at), "dd/MM/yyyy", { locale: es })}
            </p>
          </div>
          
          {/* QR Code */}
          <div className="text-center">
            <QRCodeSVG
              value={qrContent}
              size={120}
              level="H"
              includeMargin
            />
            <p className="text-xs mt-1 font-mono">Escanear para recibir</p>
          </div>
        </div>

        {/* Información de Ruta */}
        <div className="grid grid-cols-2 gap-8 mb-6">
          {/* Origen */}
          <div className="border rounded-lg p-4">
            <h3 className="font-bold text-lg mb-2 border-b pb-1">ORIGEN</h3>
            <p className="font-semibold">{hojaRuta.sucursal_origen?.nombre}</p>
            <p className="text-sm">{hojaRuta.sucursal_origen?.direccion}</p>
            <p className="text-sm">{hojaRuta.sucursal_origen?.ciudad}</p>
            {hojaRuta.sucursal_origen?.telefono && (
              <p className="text-sm">Tel: {hojaRuta.sucursal_origen.telefono}</p>
            )}
          </div>

          {/* Destino */}
          <div className="border rounded-lg p-4">
            <h3 className="font-bold text-lg mb-2 border-b pb-1">DESTINO</h3>
            <p className="font-semibold">{hojaRuta.sucursal_destino?.nombre}</p>
            <p className="text-sm">{hojaRuta.sucursal_destino?.direccion}</p>
            <p className="text-sm">{hojaRuta.sucursal_destino?.ciudad}</p>
            {hojaRuta.sucursal_destino?.telefono && (
              <p className="text-sm">Tel: {hojaRuta.sucursal_destino.telefono}</p>
            )}
          </div>
        </div>

        {/* Transporte */}
        {(hojaRuta.choferProfile || hojaRuta.vehiculo) && (
          <div className="border rounded-lg p-4 mb-6">
            <h3 className="font-bold mb-2">TRANSPORTE</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {hojaRuta.choferProfile && (
                <p>
                  <span className="font-medium">Chofer:</span>{" "}
                  {hojaRuta.choferProfile.nombre} {hojaRuta.choferProfile.apellido}
                </p>
              )}
              {hojaRuta.vehiculo && (
                <p>
                  <span className="font-medium">Vehículo:</span>{" "}
                  {hojaRuta.vehiculo.patente} ({hojaRuta.vehiculo.marca} {hojaRuta.vehiculo.modelo})
                </p>
              )}
            </div>
          </div>
        )}

        {/* Resumen */}
        <div className="bg-gray-100 rounded-lg p-4 mb-6 flex justify-around">
          <div className="text-center">
            <p className="text-3xl font-bold">{hojaRuta.cantidad_envios}</p>
            <p className="text-sm">Envíos</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">{totalBultos}</p>
            <p className="text-sm">Bultos</p>
          </div>
          {totalPeso > 0 && (
            <div className="text-center">
              <p className="text-3xl font-bold">{totalPeso.toFixed(1)}</p>
              <p className="text-sm">Kg Total</p>
            </div>
          )}
        </div>

        {/* Lista de Envíos */}
        <table className="w-full border-collapse mb-6">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="border p-2 text-left">#</th>
              <th className="border p-2 text-left">Tracking</th>
              <th className="border p-2 text-left">Destinatario</th>
              <th className="border p-2 text-left">Ciudad Destino</th>
              <th className="border p-2 text-center">Bultos</th>
              <th className="border p-2 text-center">✓</th>
            </tr>
          </thead>
          <tbody>
            {hojaRuta.envios?.map((envio: any, index: number) => (
              <tr key={envio?.id || index} className="border-b">
                <td className="border p-2">{index + 1}</td>
                <td className="border p-2 font-mono text-sm">{envio?.tracking_number}</td>
                <td className="border p-2">
                  {envio?.nombre_destinatario || `${envio?.destinatario?.nombre || ''} ${envio?.destinatario?.apellido || ''}`.trim()}
                </td>
                <td className="border p-2 text-sm">{envio?.destinatario?.ciudad}</td>
                <td className="border p-2 text-center">{envio?.cantidad_bultos || 1}</td>
                <td className="border p-2 text-center">
                  <div className="w-6 h-6 border-2 border-gray-400 mx-auto"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Notas */}
        {hojaRuta.notas && (
          <div className="border rounded-lg p-4 mb-6">
            <h3 className="font-bold mb-2">OBSERVACIONES</h3>
            <p className="text-sm">{hojaRuta.notas}</p>
          </div>
        )}

        {/* Firmas */}
        <div className="grid grid-cols-2 gap-8 mt-12 pt-8">
          <div className="text-center">
            <div className="border-t-2 border-black pt-2 mx-8">
              <p className="font-medium">Firma Despacho</p>
              <p className="text-sm text-gray-600">Sucursal Origen</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t-2 border-black pt-2 mx-8">
              <p className="font-medium">Firma Recepción</p>
              <p className="text-sm text-gray-600">Sucursal Destino</p>
            </div>
          </div>
        </div>

        {/* Pie de página */}
        <div className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
          <p>Documento generado el {format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}</p>
          <p className="font-mono mt-1">ID: {hojaRuta.id}</p>
        </div>
      </div>

      {/* Estilos de impresión */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20mm;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>
    </>
  );
}

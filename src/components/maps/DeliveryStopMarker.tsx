import { memo } from 'react';
import { Marker, InfoWindow } from '@react-google-maps/api';
import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DeliveryStopMarkerProps {
  position: { lat: number; lng: number };
  time: string;
  trackingNumber: string;
  order: number;
  type?: 'retiro' | 'entrega' | 'sucursal';
  onClick?: () => void;
}

const markerColors: Record<string, { fill: string; stroke: string }> = {
  entrega: { fill: '#10B981', stroke: '#059669' },
  retiro: { fill: '#F59E0B', stroke: '#D97706' },
  sucursal: { fill: '#3B82F6', stroke: '#2563EB' },
};

const typeLabels: Record<string, string> = {
  entrega: 'Entrega',
  retiro: 'Retiro',
  sucursal: 'Sucursal',
};

function DeliveryStopMarkerComponent({
  position,
  time,
  trackingNumber,
  order,
  type = 'entrega',
  onClick,
}: DeliveryStopMarkerProps) {
  const [showInfo, setShowInfo] = useState(false);

  const parsedDate = time ? new Date(time) : null;
  const formattedTime = parsedDate && !isNaN(parsedDate.getTime())
    ? format(parsedDate, "HH:mm", { locale: es })
    : '';

  const colors = markerColors[type] || markerColors.entrega;
  const label = typeLabels[type] || 'Entrega';

  return (
    <>
      <Marker
        position={position}
        icon={{
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: colors.fill,
          fillOpacity: 1,
          strokeColor: colors.stroke,
          strokeWeight: 2,
          scale: 14,
          labelOrigin: new google.maps.Point(0, 0),
        }}
        label={{
          text: order.toString(),
          color: '#ffffff',
          fontSize: '11px',
          fontWeight: 'bold',
        }}
        title={`${label} #${order} - ${trackingNumber}`}
        onClick={() => {
          setShowInfo(true);
          onClick?.();
        }}
      />
      
      {showInfo && (
        <InfoWindow
          position={position}
          onCloseClick={() => setShowInfo(false)}
        >
          <div className="p-2 min-w-[120px]">
            <p className="font-semibold text-sm text-gray-900">{label} #{order}</p>
            <p className="text-xs text-gray-600 mt-1">{trackingNumber}</p>
            {formattedTime && (
              <p className="text-xs text-gray-500 mt-1">🕐 {formattedTime}</p>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export const DeliveryStopMarker = memo(DeliveryStopMarkerComponent);
export default DeliveryStopMarker;

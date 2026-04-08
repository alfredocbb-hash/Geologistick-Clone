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
          path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
          fillColor: colors.fill,
          fillOpacity: 1,
          strokeColor: colors.stroke,
          strokeWeight: 2,
          scale: 2.0,
          anchor: new google.maps.Point(12, 24),
          labelOrigin: new google.maps.Point(12, 10),
        }}
        label={{
          text: order.toString(),
          color: '#ffffff',
          fontSize: '13px',
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

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
  onClick?: () => void;
}

function DeliveryStopMarkerComponent({
  position,
  time,
  trackingNumber,
  order,
  onClick,
}: DeliveryStopMarkerProps) {
  const [showInfo, setShowInfo] = useState(false);

  const formattedTime = time 
    ? format(new Date(time), "HH:mm", { locale: es })
    : '';

  return (
    <>
      <Marker
        position={position}
        icon={{
          path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
          fillColor: '#10B981',
          fillOpacity: 1,
          strokeColor: '#059669',
          strokeWeight: 1,
          scale: 1.5,
          anchor: new google.maps.Point(12, 24),
          labelOrigin: new google.maps.Point(12, 9),
        }}
        label={{
          text: order.toString(),
          color: '#ffffff',
          fontSize: '10px',
          fontWeight: 'bold',
        }}
        title={`Entrega #${order} - ${trackingNumber}`}
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
            <p className="font-semibold text-sm text-gray-900">Entrega #{order}</p>
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

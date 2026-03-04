import { memo, useState } from 'react';
import { OverlayView, InfoWindow } from '@react-google-maps/api';
import { Truck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export interface DriverMarkerData {
  nombre?: string;
  apellido?: string;
  updated_at?: string;
  ruta_activa?: {
    id: string;
    numero: string;
    estado: string;
  } | null;
}

interface DriverMarkerProps {
  position: { lat: number; lng: number };
  data?: DriverMarkerData;
  onClick?: () => void;
}

function getStatusColor(updatedAt?: string): string {
  if (!updatedAt) return '#9ca3af'; // gray
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  const diffMin = diffMs / 60000;
  if (diffMin < 5) return '#22c55e';   // green - active
  if (diffMin < 15) return '#eab308';  // yellow - idle
  return '#9ca3af';                     // gray - offline
}

function getInitials(nombre?: string, apellido?: string): string {
  const n = nombre?.charAt(0)?.toUpperCase() || '';
  const a = apellido?.charAt(0)?.toUpperCase() || '';
  return n + a || '';
}

function getStatusLabel(updatedAt?: string): string {
  if (!updatedAt) return 'Sin señal';
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  const diffMin = diffMs / 60000;
  if (diffMin < 5) return 'Activo';
  if (diffMin < 15) return 'Reciente';
  return 'Sin señal';
}

function DriverMarkerComponent({ position, data, onClick }: DriverMarkerProps) {
  const [showInfo, setShowInfo] = useState(false);
  const statusColor = getStatusColor(data?.updated_at);
  const initials = getInitials(data?.nombre, data?.apellido);
  const isActive = data?.updated_at && (Date.now() - new Date(data.updated_at).getTime()) < 300000;

  return (
    <>
      <OverlayView
        position={position}
        mapPaneName={OverlayView.FLOAT_PANE}
        getPixelPositionOffset={() => ({ x: -20, y: -20 })}
      >
        <div
          className="relative flex items-center justify-center cursor-pointer"
          style={{ width: 40, height: 40 }}
          onClick={() => {
            setShowInfo(prev => !prev);
            onClick?.();
          }}
        >
          {/* Pulse ring - only when active */}
          {isActive && (
            <div
              className="absolute inset-0 rounded-full animate-driver-pulse"
              style={{ backgroundColor: statusColor, opacity: 0.4 }}
            />
          )}

          {/* Main circle */}
          <div
            className="relative flex items-center justify-center rounded-full shadow-lg"
            style={{
              width: 40,
              height: 40,
              backgroundColor: statusColor,
              border: '3px solid white',
              boxShadow: `0 2px 8px ${statusColor}80`,
            }}
          >
            {initials ? (
              <span className="text-white font-bold text-sm leading-none select-none">
                {initials}
              </span>
            ) : (
              <Truck className="h-4 w-4 text-white" />
            )}
          </div>
        </div>
      </OverlayView>

      {showInfo && (
        <InfoWindow
          position={position}
          onCloseClick={() => setShowInfo(false)}
          options={{ pixelOffset: new google.maps.Size(0, -28) }}
        >
          <div className="p-2 min-w-[160px]">
            <p className="font-semibold text-sm text-gray-900">
              {data?.nombre || 'Chofer'} {data?.apellido || ''}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: statusColor }}
              />
              <span className="text-xs text-gray-600">
                {getStatusLabel(data?.updated_at)}
              </span>
            </div>
            {data?.updated_at && (
              <p className="text-xs text-gray-500 mt-1">
                🕐 {formatDistanceToNow(new Date(data.updated_at), { addSuffix: true, locale: es })}
              </p>
            )}
            {data?.ruta_activa && (
              <p className="text-xs text-gray-600 mt-1 font-medium">
                🚛 Ruta {data.ruta_activa.numero}
              </p>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export const DriverMarker = memo(DriverMarkerComponent);
export default DriverMarker;

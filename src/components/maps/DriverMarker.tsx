import { memo, useState, useRef, useEffect, useCallback } from 'react';
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
  if (!updatedAt) return '#9ca3af';
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  const diffMin = diffMs / 60000;
  if (diffMin < 5) return '#22c55e';
  if (diffMin < 15) return '#eab308';
  return '#9ca3af';
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

/** Calculate bearing in degrees between two lat/lng points */
function calcBearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Distance in meters between two coords */
function distanceBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const ANIMATION_DURATION = 1000; // ms

function DriverMarkerComponent({ position, data, onClick }: DriverMarkerProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [animatedPos, setAnimatedPos] = useState(position);
  const [heading, setHeading] = useState<number | null>(null);

  const prevPosRef = useRef(position);
  const animFrameRef = useRef<number>(0);

  const statusColor = getStatusColor(data?.updated_at);
  const initials = getInitials(data?.nombre, data?.apellido);
  const isActive = data?.updated_at && (Date.now() - new Date(data.updated_at).getTime()) < 300000;

  // Interpolate position when prop changes
  useEffect(() => {
    const from = prevPosRef.current;
    const to = position;

    // Skip animation if distance is too small (<2m) or too large (>50km, likely a data jump)
    const dist = distanceBetween(from, to);
    if (dist < 2) {
      prevPosRef.current = to;
      return;
    }
    if (dist > 50000) {
      setAnimatedPos(to);
      prevPosRef.current = to;
      return;
    }

    // Calculate heading
    const bearing = calcBearing(from, to);
    setHeading(bearing);

    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / ANIMATION_DURATION, 1);
      // Ease-out cubic
      const ease = 1 - Math.pow(1 - t, 3);

      setAnimatedPos({
        lat: from.lat + (to.lat - from.lat) * ease,
        lng: from.lng + (to.lng - from.lng) * ease,
      });

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        prevPosRef.current = to;
      }
    };

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [position.lat, position.lng]);

  const handleClick = useCallback(() => {
    setShowInfo(prev => !prev);
    onClick?.();
  }, [onClick]);

  return (
    <>
      <OverlayView
        position={animatedPos}
        mapPaneName={OverlayView.FLOAT_PANE}
        getPixelPositionOffset={() => ({ x: -20, y: -20 })}
      >
        <div
          className="relative flex items-center justify-center cursor-pointer"
          style={{ width: 40, height: 40 }}
          onClick={handleClick}
        >
          {/* Pulse ring - only when active */}
          {isActive && (
            <div
              className="absolute inset-0 rounded-full animate-driver-pulse"
              style={{ backgroundColor: statusColor, opacity: 0.4 }}
            />
          )}

          {/* Main circle with heading rotation */}
          <div
            className="relative flex items-center justify-center rounded-full shadow-lg"
            style={{
              width: 40,
              height: 40,
              backgroundColor: statusColor,
              border: '3px solid white',
              boxShadow: `0 2px 8px ${statusColor}80`,
              transition: 'transform 0.3s ease-out',
              transform: heading !== null ? `rotate(${heading}deg)` : undefined,
            }}
          >
            {initials ? (
              <span
                className="text-white font-bold text-sm leading-none select-none"
                style={{
                  // Counter-rotate text so it stays upright
                  transform: heading !== null ? `rotate(${-heading}deg)` : undefined,
                  transition: 'transform 0.3s ease-out',
                }}
              >
                {initials}
              </span>
            ) : (
              <Truck
                className="h-4 w-4 text-white"
                style={{
                  transform: heading !== null ? `rotate(${-heading}deg)` : undefined,
                  transition: 'transform 0.3s ease-out',
                }}
              />
            )}

            {/* Direction indicator arrow */}
            {heading !== null && isActive && (
              <div
                className="absolute -top-1 left-1/2 w-0 h-0"
                style={{
                  marginLeft: -4,
                  borderLeft: '4px solid transparent',
                  borderRight: '4px solid transparent',
                  borderBottom: `6px solid ${statusColor}`,
                }}
              />
            )}
          </div>
        </div>
      </OverlayView>

      {showInfo && (
        <InfoWindow
          position={animatedPos}
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

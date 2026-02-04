import { memo, useMemo } from 'react';
import { Polyline, Marker } from '@react-google-maps/api';

interface GradientPolylineProps {
  path: { lat: number; lng: number }[];
  segments?: number;
  showArrows?: boolean;
  showStartMarker?: boolean;
  showEndMarker?: boolean;
}

// Generate gradient colors from green to blue
function generateGradientColors(numColors: number): string[] {
  const colors: string[] = [];
  
  for (let i = 0; i < numColors; i++) {
    const ratio = i / (numColors - 1);
    
    // Start: Light green (#90EE90) → Middle: Dark green (#228B22) → End: Blue (#4285F4)
    let r, g, b;
    
    if (ratio < 0.5) {
      // Green phase: light green to dark green
      const localRatio = ratio * 2;
      r = Math.round(144 - localRatio * 110); // 144 → 34
      g = Math.round(238 - localRatio * 99);  // 238 → 139
      b = Math.round(144 - localRatio * 110); // 144 → 34
    } else {
      // Blue phase: dark green to blue
      const localRatio = (ratio - 0.5) * 2;
      r = Math.round(34 + localRatio * 32);   // 34 → 66
      g = Math.round(139 - localRatio * 6);   // 139 → 133
      b = Math.round(34 + localRatio * 210);  // 34 → 244
    }
    
    colors.push(`rgb(${r}, ${g}, ${b})`);
  }
  
  return colors;
}

function GradientPolylineComponent({
  path,
  segments = 10,
  showArrows = true,
  showStartMarker = false,
  showEndMarker = false,
}: GradientPolylineProps) {
  // Split path into segments with gradient colors
  const polylineSegments = useMemo(() => {
    if (path.length < 2) return [];
    
    const numSegments = Math.min(segments, Math.floor(path.length / 2));
    if (numSegments < 2) {
      // Not enough points for gradient, return single polyline
      return [{
        path: path,
        color: '#4285F4',
        isLast: true,
      }];
    }
    
    const colors = generateGradientColors(numSegments);
    const pointsPerSegment = Math.ceil(path.length / numSegments);
    const result: { path: { lat: number; lng: number }[]; color: string; isLast: boolean }[] = [];
    
    for (let i = 0; i < numSegments; i++) {
      const startIdx = i * pointsPerSegment;
      const endIdx = Math.min((i + 1) * pointsPerSegment + 1, path.length);
      
      if (startIdx >= path.length - 1) break;
      
      const segmentPath = path.slice(startIdx, endIdx);
      if (segmentPath.length >= 2) {
        result.push({
          path: segmentPath,
          color: colors[i],
          isLast: i === numSegments - 1,
        });
      }
    }
    
    return result;
  }, [path, segments]);

  if (path.length < 2) return null;

  return (
    <>
      {/* Shadow layer for all segments */}
      {polylineSegments.map((segment, idx) => (
        <Polyline
          key={`shadow-${idx}`}
          path={segment.path}
          options={{
            strokeColor: '#1e3a5f',
            strokeWeight: 8,
            strokeOpacity: 0.3,
            geodesic: true,
            zIndex: 1,
          }}
        />
      ))}
      
      {/* Main gradient segments */}
      {polylineSegments.map((segment, idx) => (
        <Polyline
          key={`segment-${idx}`}
          path={segment.path}
          options={{
            strokeColor: segment.color,
            strokeWeight: 5,
            strokeOpacity: 0.95,
            geodesic: true,
            zIndex: 2,
            icons: showArrows && segment.isLast ? [{
              icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 2.5,
                strokeColor: '#ffffff',
                strokeWeight: 1,
                fillColor: segment.color,
                fillOpacity: 1,
              },
              repeat: '150px',
            }] : undefined,
          }}
        />
      ))}
      
      {/* Start marker */}
      {showStartMarker && path.length > 0 && (
        <Marker
          position={path[0]}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#90EE90',
            fillOpacity: 1,
            strokeColor: '#228B22',
            strokeWeight: 2,
          }}
          title="Inicio del recorrido"
        />
      )}
      
      {/* End marker */}
      {showEndMarker && path.length > 1 && (
        <Marker
          position={path[path.length - 1]}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#1a5cc9',
            strokeWeight: 2,
          }}
          title="Posición actual"
        />
      )}
    </>
  );
}

export const GradientPolyline = memo(GradientPolylineComponent);
export default GradientPolyline;

import { useEffect, useRef } from 'react';
import { useGoogleMaps } from './GoogleMapsProvider';

interface HeatmapPoint {
  lat: number;
  lng: number;
  weight?: number;
}

interface HeatmapLayerProps {
  points: HeatmapPoint[];
  map: google.maps.Map | null;
  radius?: number;
  opacity?: number;
}

export function HeatmapLayer({ points, map, radius = 30, opacity = 0.7 }: HeatmapLayerProps) {
  const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);
  const { isLoaded } = useGoogleMaps();

  useEffect(() => {
    if (!isLoaded || !map || !window.google?.maps?.visualization) return;

    const data = points.map(p => ({
      location: new google.maps.LatLng(p.lat, p.lng),
      weight: p.weight || 1,
    }));

    if (heatmapRef.current) {
      heatmapRef.current.setData(data);
    } else {
      heatmapRef.current = new google.maps.visualization.HeatmapLayer({
        data,
        map,
        radius,
        opacity,
        gradient: [
          'rgba(0, 255, 0, 0)',
          'rgba(0, 255, 0, 1)',
          'rgba(255, 255, 0, 1)',
          'rgba(255, 165, 0, 1)',
          'rgba(255, 0, 0, 1)',
        ],
      });
    }

    return () => {
      if (heatmapRef.current) {
        heatmapRef.current.setMap(null);
        heatmapRef.current = null;
      }
    };
  }, [isLoaded, map, points, radius, opacity]);

  return null;
}

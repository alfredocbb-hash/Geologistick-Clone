import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Gauge, Package, Route } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RouteStatsPanelProps {
  stats: {
    pointsCount: number;
    snappedPointsCount: number;
    startTime: string | null;
    endTime: string | null;
    totalDistanceKm: number;
    durationMinutes: number;
    avgSpeedKmh: number;
    stopsCount: number;
  };
  driverName?: string;
  routeNumber?: string;
  isLoading?: boolean;
  isSnapping?: boolean;
  compact?: boolean;
}

function RouteStatsPanelComponent({
  stats,
  driverName,
  routeNumber,
  isLoading,
  isSnapping,
  compact = false,
}: RouteStatsPanelProps) {
  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="py-3">
          <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-muted rounded w-1/2"></div>
        </CardContent>
      </Card>
    );
  }

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline" className="gap-1">
          <Route className="h-3 w-3" />
          {stats.totalDistanceKm.toFixed(1)} km
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          {formatDuration(stats.durationMinutes)}
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Gauge className="h-3 w-3" />
          {stats.avgSpeedKmh} km/h
        </Badge>
        {stats.stopsCount > 0 && (
          <Badge variant="outline" className="gap-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
            <Package className="h-3 w-3" />
            {stats.stopsCount} entregas
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="py-4">
        {/* Header */}
        {(driverName || routeNumber) && (
          <div className="flex items-center justify-between mb-4">
            <div>
              {driverName && (
                <p className="font-semibold text-sm">{driverName}</p>
              )}
              {routeNumber && (
                <p className="text-xs text-muted-foreground">Ruta: {routeNumber}</p>
              )}
            </div>
            {isSnapping && (
              <Badge variant="secondary" className="text-xs animate-pulse">
                Procesando...
              </Badge>
            )}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Distance */}
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Route className="h-3.5 w-3.5" />
              <span className="text-xs">Distancia</span>
            </div>
            <p className="font-bold text-lg">{stats.totalDistanceKm.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">km</p>
          </div>

          {/* Duration */}
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-xs">Tiempo</span>
            </div>
            <p className="font-bold text-lg">{formatDuration(stats.durationMinutes)}</p>
            <p className="text-xs text-muted-foreground">
              {stats.startTime && format(new Date(stats.startTime), "HH:mm", { locale: es })}
              {stats.startTime && stats.endTime && " - "}
              {stats.endTime && format(new Date(stats.endTime), "HH:mm", { locale: es })}
            </p>
          </div>

          {/* Speed */}
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Gauge className="h-3.5 w-3.5" />
              <span className="text-xs">Vel. Promedio</span>
            </div>
            <p className="font-bold text-lg">{stats.avgSpeedKmh}</p>
            <p className="text-xs text-muted-foreground">km/h</p>
          </div>

          {/* Stops */}
          <div className={`rounded-lg p-3 text-center ${stats.stopsCount > 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-muted/50'}`}>
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Package className="h-3.5 w-3.5" />
              <span className="text-xs">Entregas</span>
            </div>
            <p className={`font-bold text-lg ${stats.stopsCount > 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
              {stats.stopsCount}
            </p>
            <p className="text-xs text-muted-foreground">completadas</p>
          </div>
        </div>

        {/* Points info */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span>{stats.pointsCount} puntos GPS</span>
          </div>
          {stats.snappedPointsCount > 0 && (
            <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <Route className="h-3 w-3" />
              <span>{stats.snappedPointsCount} sobre calles</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const RouteStatsPanel = memo(RouteStatsPanelComponent);
export default RouteStatsPanel;

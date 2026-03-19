import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Clock, Eye, EyeOff, Route, Bot, Loader2, AlertTriangle, Gauge, PauseCircle, CheckCircle, XCircle, Package, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DriverEnhancedData } from '@/hooks/useDriverRouteProgress';

interface DriverLocation {
  id: string;
  chofer_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  updated_at: string;
  nombre?: string;
  apellido?: string;
  ruta_activa?: { id: string; numero: string; estado: string } | null;
  ultima_ruta?: { id: string; numero: string; estado: string; fecha: string; tiene_historial: boolean } | null;
}

interface DriverCardEnhancedProps {
  driver: DriverLocation;
  enhancedData?: DriverEnhancedData;
  isSelected: boolean;
  isAnalyzing: boolean;
  analysis: any;
  onToggleRoute: (driverId: string, rutaId: string) => void;
  onViewDetails: (driverId: string, rutaId: string) => void;
  onAnalyze: (driver: DriverLocation) => void;
  onOpenPanel: (driverId: string) => void;
  onCloseAnalysis: (driverId: string) => void;
  getRiskBadge: (risk: string) => React.ReactNode;
  idleAlertMinutes: number;
}

function getDriverStatus(updatedAt: string) {
  const now = new Date();
  const updated = new Date(updatedAt);
  const diffMinutes = (now.getTime() - updated.getTime()) / (1000 * 60);
  if (diffMinutes < 5) return { color: 'bg-green-500', label: 'Activo' };
  if (diffMinutes < 15) return { color: 'bg-yellow-500', label: 'Reciente' };
  return { color: 'bg-red-500', label: 'Sin señal' };
}

function getSpeedBadge(speed: number | null | undefined) {
  if (speed === null || speed === undefined) return null;
  if (speed < 2) {
    return (
      <Badge variant="outline" className="text-xs gap-1 border-orange-500/30 text-orange-600 dark:text-orange-400">
        <PauseCircle className="h-3 w-3" />
        Detenido
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs gap-1 border-blue-500/30 text-blue-600 dark:text-blue-400">
      <Gauge className="h-3 w-3" />
      {Math.round(speed)} km/h
    </Badge>
  );
}

export function DriverCardEnhanced({
  driver,
  enhancedData,
  isSelected,
  isAnalyzing,
  analysis,
  onToggleRoute,
  onViewDetails,
  onAnalyze,
  onOpenPanel,
  onCloseAnalysis,
  getRiskBadge,
  idleAlertMinutes,
}: DriverCardEnhancedProps) {
  const status = getDriverStatus(driver.updated_at);
  const hasActiveRoute = !!driver.ruta_activa;
  const hasHistoricalRoute = !hasActiveRoute && !!driver.ultima_ruta;
  const progress = enhancedData?.routeProgress;
  const isIdle = hasActiveRoute && enhancedData && enhancedData.idleMinutes >= idleAlertMinutes && enhancedData.speed !== null && (enhancedData.speed ?? 0) < 2;

  return (
    <div
      className={`rounded-lg border overflow-hidden transition-colors ${
        isIdle ? 'bg-orange-500/5 border-orange-500/30' : 'bg-muted/50'
      } ${isSelected ? 'ring-2 ring-primary' : ''}`}
    >
      {/* Idle Alert Banner */}
      {isIdle && (
        <div className="bg-orange-500/10 px-3 py-1.5 flex items-center gap-2 border-b border-orange-500/20">
          <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
          <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
            Detenido hace {enhancedData!.idleMinutes} min
          </span>
        </div>
      )}

      <div className="p-3 space-y-2">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${status.color}`} />
            <div className="min-w-0">
              <button
                className="text-sm font-medium hover:underline cursor-pointer truncate block text-left"
                onClick={() => onOpenPanel(driver.chofer_id)}
              >
                {driver.nombre} {driver.apellido}
              </button>
              {hasActiveRoute && (
                <p className="text-xs text-muted-foreground truncate">
                  Ruta: {driver.ruta_activa!.numero}
                </p>
              )}
              {hasHistoricalRoute && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Última: {formatDistanceToNow(new Date(driver.ultima_ruta!.fecha), { addSuffix: true, locale: es })}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs">
                {status.label}
              </Badge>
              {getSpeedBadge(enhancedData?.speed)}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(driver.updated_at), { addSuffix: true, locale: es })}
            </p>
          </div>
        </div>

        {/* Route Progress */}
        {hasActiveRoute && progress && progress.total > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progreso de ruta</span>
              <span className="font-medium">{progress.percentage}%</span>
            </div>
            <Progress value={progress.percentage} className="h-2" />
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                {progress.completed}
              </span>
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3 text-yellow-500" />
                {progress.pending}
              </span>
              {progress.failed > 0 && (
                <span className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-500" />
                  {progress.failed}
                </span>
              )}
              <span className="ml-auto text-muted-foreground">{progress.total} total</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-1 flex-wrap">
          {hasActiveRoute && (
            <>
              <Button
                size="sm"
                variant={isSelected ? 'default' : 'ghost'}
                className="h-6 text-xs px-2"
                onClick={() => onToggleRoute(driver.chofer_id, driver.ruta_activa!.id)}
              >
                {isSelected ? (
                  <><EyeOff className="h-3 w-3 mr-1" />Ocultar</>
                ) : (
                  <><Eye className="h-3 w-3 mr-1" />Ver en mapa</>
                )}
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => onViewDetails(driver.chofer_id, driver.ruta_activa!.id)}>
                <Route className="h-3 w-3 mr-1" />Detalles
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => onAnalyze(driver)} disabled={isAnalyzing}>
                {isAnalyzing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Bot className="h-3 w-3 mr-1" />}
                IA
              </Button>
            </>
          )}
          {hasHistoricalRoute && (
            <Button
              size="sm"
              variant={isSelected ? 'default' : 'outline'}
              className="h-6 text-xs px-2"
              onClick={() => onToggleRoute(driver.chofer_id, driver.ultima_ruta!.id)}
            >
              {isSelected ? (
                <><EyeOff className="h-3 w-3 mr-1" />Ocultar</>
              ) : (
                <><Route className="h-3 w-3 mr-1" />Ver último recorrido</>
              )}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-6 text-xs px-2 ml-auto" onClick={() => onOpenPanel(driver.chofer_id)}>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* AI Analysis inline */}
      {analysis && (
        <div className="border-t px-3 py-2 bg-muted/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium">Análisis IA</span>
            </div>
            {getRiskBadge(analysis.riesgo_demora)}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-background/60 rounded p-1.5">
              <span className="text-muted-foreground">ETA próxima:</span>
              <span className="font-medium ml-1">{analysis.eta_proxima_parada}</span>
            </div>
            <div className="bg-background/60 rounded p-1.5">
              <span className="text-muted-foreground">Fin ruta:</span>
              <span className="font-medium ml-1">{analysis.eta_fin_ruta}</span>
            </div>
          </div>
          {analysis.anomalias?.length > 0 && (
            <div className="space-y-1">
              {analysis.anomalias.map((a: any, idx: number) => (
                <div key={idx} className={`text-xs rounded px-2 py-1 ${
                  a.severidad === 'critical' ? 'bg-red-500/10 text-red-700 dark:text-red-400' :
                  a.severidad === 'warning' ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' :
                  'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                }`}>
                  {a.severidad === 'critical' ? '🔴' : a.severidad === 'warning' ? '⚠️' : 'ℹ️'} {a.mensaje}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground italic">{analysis.resumen}</p>
          <Button size="sm" variant="ghost" className="h-5 text-xs px-1" onClick={() => onCloseAnalysis(driver.chofer_id)}>
            ✕ Cerrar
          </Button>
        </div>
      )}
    </div>
  );
}

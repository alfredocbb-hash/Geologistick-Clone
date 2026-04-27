import { CheckCircle2, AlertCircle, Clock, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MLSyncBadgeProps {
  ml_shipment_id?: string | number | null;
  ml_sync_status?: string | null;
  ml_sync_error_detail?: string | null;
  ml_last_sync_at?: string | null;
  /** Compact mode: icon only */
  compact?: boolean;
  className?: string;
}

export function MLSyncBadge({
  ml_shipment_id,
  ml_sync_status,
  ml_sync_error_detail,
  ml_last_sync_at,
  compact = false,
  className,
}: MLSyncBadgeProps) {
  // Only show for ML shipments
  if (!ml_shipment_id) return null;

  const status = ml_sync_status || (ml_last_sync_at ? "synced" : "pending");

  let Icon = Clock;
  let label = "ML Pendiente";
  let colorClasses = "bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400";

  if (status === "synced" || status === "ok" || status === "success") {
    Icon = CheckCircle2;
    label = "ML Sincronizado";
    colorClasses = "bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400";
  } else if (status === "error" || status === "failed") {
    Icon = AlertCircle;
    label = "Error ML";
    colorClasses = "bg-destructive/10 text-destructive border-destructive/30";
  } else if (status === "syncing") {
    Icon = RefreshCw;
    label = "Sincronizando";
    colorClasses = "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400";
  }

  const lastSyncText = ml_last_sync_at
    ? `Última sincronización: ${formatDistanceToNow(new Date(ml_last_sync_at), { addSuffix: true, locale: es })}`
    : "Sin sincronización aún";

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "gap-1 text-xs font-medium border h-5 px-1.5 cursor-default",
              colorClasses,
              className
            )}
          >
            <Icon className={cn("h-3 w-3", status === "syncing" && "animate-spin")} />
            {!compact && <span>{label}</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1 text-xs">
            <p className="font-semibold">{label}</p>
            <p className="text-muted-foreground">{lastSyncText}</p>
            {ml_sync_error_detail && (status === "error" || status === "failed") && (
              <p className="text-destructive border-t pt-1 mt-1 break-words">
                {ml_sync_error_detail}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

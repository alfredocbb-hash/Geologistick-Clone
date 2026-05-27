import { Badge } from '@/components/ui/badge';
import { CalendarClock } from 'lucide-react';
import {
  getMLSubstatusLabel,
  isNoteworthyMLSubstatus,
  isRescheduledMLSubstatus,
} from '@/lib/mlSubstatusLabels';

interface MLSubstatusBadgeProps {
  substatus?: string | null;
  /** Only render if the ml_shipment_id exists (passed from caller). Defaults to true. */
  isML?: boolean;
  className?: string;
}

/**
 * Renders a compact badge with the human label of a ML substatus.
 * Only shows for noteworthy substatuses (reprogramaciones, visitas, etc).
 */
export function MLSubstatusBadge({ substatus, isML = true, className }: MLSubstatusBadgeProps) {
  if (!isML) return null;
  if (!isNoteworthyMLSubstatus(substatus)) return null;

  const label = getMLSubstatusLabel(substatus);
  const isReprog = isRescheduledMLSubstatus(substatus);

  return (
    <Badge
      variant="outline"
      className={
        (isReprog
          ? 'bg-yellow-50 border-yellow-300 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-600 dark:text-yellow-300 '
          : 'bg-orange-50 border-orange-300 text-orange-800 dark:bg-orange-900/30 dark:border-orange-600 dark:text-orange-300 ') +
        'text-xs gap-1 ' +
        (className || '')
      }
    >
      {isReprog && <CalendarClock className="h-3 w-3" />}
      {label}
    </Badge>
  );
}

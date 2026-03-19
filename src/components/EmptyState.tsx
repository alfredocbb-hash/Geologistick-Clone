import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Package, MapPin, Truck, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  variant?: 'shipments' | 'routes' | 'drivers' | 'default';
}

const ILLUSTRATIONS: Record<string, { Icon: LucideIcon; gradient: string }> = {
  shipments: { Icon: Package, gradient: 'from-primary/20 to-primary/5' },
  routes: { Icon: MapPin, gradient: 'from-blue-500/20 to-blue-500/5' },
  drivers: { Icon: Truck, gradient: 'from-orange-500/20 to-orange-500/5' },
  default: { Icon: Package, gradient: 'from-muted to-muted/50' },
};

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  variant = 'default',
}: EmptyStateProps) {
  const { Icon: DefaultIcon, gradient } = ILLUSTRATIONS[variant];
  const DisplayIcon = icon || DefaultIcon;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* Animated illustration circle */}
      <div className={`relative mb-6`}>
        <div className={`h-28 w-28 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center animate-pulse`}>
          <DisplayIcon className="h-12 w-12 text-muted-foreground/60" />
        </div>
        {/* Decorative dots */}
        <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary/30 animate-bounce" style={{ animationDelay: '0.2s' }} />
        <div className="absolute -bottom-2 -left-2 h-2 w-2 rounded-full bg-primary/20 animate-bounce" style={{ animationDelay: '0.5s' }} />
        <div className="absolute top-1/2 -right-4 h-2 w-2 rounded-full bg-primary/15 animate-bounce" style={{ animationDelay: '0.8s' }} />
      </div>

      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-sm mb-6">{description}</p>

      {actionLabel && actionHref && (
        <Button asChild>
          <Link to={actionHref}>{actionLabel} →</Link>
        </Button>
      )}
      {actionLabel && onAction && !actionHref && (
        <Button onClick={onAction}>{actionLabel} →</Button>
      )}
    </div>
  );
}

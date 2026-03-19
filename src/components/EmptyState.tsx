import { Package, Route, Truck, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

const VARIANTS: Record<string, { icon: LucideIcon; title: string; description: string }> = {
  shipments: {
    icon: Package,
    title: 'Sin envíos',
    description: 'No hay envíos para mostrar. Crea uno nuevo para comenzar.',
  },
  routes: {
    icon: Route,
    title: 'Sin rutas',
    description: 'No hay rutas planificadas. Crea una ruta para organizar tus entregas.',
  },
  drivers: {
    icon: Truck,
    title: 'Sin conductores',
    description: 'No hay conductores registrados. Agrega uno para empezar.',
  },
};

interface EmptyStateProps {
  variant?: keyof typeof VARIANTS;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: LucideIcon;
}

export function EmptyState({
  variant = 'shipments',
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  const config = VARIANTS[variant] || VARIANTS.shipments;
  const Icon = icon || config.icon;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4 animate-pulse">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">
        {title || config.title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {description || config.description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}

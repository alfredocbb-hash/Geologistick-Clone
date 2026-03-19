import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, ArrowUpDown } from 'lucide-react';

export type DriverFilterStatus = 'all' | 'active' | 'recent' | 'no_signal';
export type DriverFilterRoute = 'all' | 'with_route' | 'without_route';
export type DriverSortBy = 'last_update' | 'name' | 'progress';

interface DriverFiltersProps {
  filterStatus: DriverFilterStatus;
  filterRoute: DriverFilterRoute;
  sortBy: DriverSortBy;
  onFilterStatusChange: (v: DriverFilterStatus) => void;
  onFilterRouteChange: (v: DriverFilterRoute) => void;
  onSortByChange: (v: DriverSortBy) => void;
}

export function DriverFilters({
  filterStatus,
  filterRoute,
  sortBy,
  onFilterStatusChange,
  onFilterRouteChange,
  onSortByChange,
}: DriverFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Select value={filterStatus} onValueChange={(v) => onFilterStatusChange(v as DriverFilterStatus)}>
        <SelectTrigger className="h-7 text-xs w-auto min-w-[100px]">
          <Filter className="h-3 w-3 mr-1" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="active">Activos</SelectItem>
          <SelectItem value="recent">Recientes</SelectItem>
          <SelectItem value="no_signal">Sin señal</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filterRoute} onValueChange={(v) => onFilterRouteChange(v as DriverFilterRoute)}>
        <SelectTrigger className="h-7 text-xs w-auto min-w-[100px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las rutas</SelectItem>
          <SelectItem value="with_route">Con ruta activa</SelectItem>
          <SelectItem value="without_route">Sin ruta</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sortBy} onValueChange={(v) => onSortByChange(v as DriverSortBy)}>
        <SelectTrigger className="h-7 text-xs w-auto min-w-[100px]">
          <ArrowUpDown className="h-3 w-3 mr-1" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="last_update">Últ. actualización</SelectItem>
          <SelectItem value="name">Nombre</SelectItem>
          <SelectItem value="progress">Progreso</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

import { useState } from 'react';
import { Building2, Check, ChevronsUpDown, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSuperAdminTenantFilter } from '@/components/providers/SuperAdminTenantFilterProvider';
import { cn } from '@/lib/utils';

export function SuperAdminTenantSelector() {
  const { enabled, tenants, selectedTenantId, setSelectedTenantId, selectedTenant } =
    useSuperAdminTenantFilter();
  const [open, setOpen] = useState(false);

  if (!enabled) return null;

  const label = selectedTenant?.nombre ?? 'Todos los tenants';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 gap-2 max-w-[240px]"
        >
          {selectedTenant ? (
            <Building2 className="h-4 w-4 text-primary shrink-0" />
          ) : (
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className="truncate">{label}</span>
          {selectedTenant && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0">
              SA
            </Badge>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-auto" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Buscar tenant..." />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all"
                onSelect={() => {
                  setSelectedTenantId('all');
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    selectedTenantId === 'all' ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                Todos los tenants
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Tenants">
              {tenants.map(t => (
                <CommandItem
                  key={t.id}
                  value={`${t.nombre} ${t.slug}`}
                  onSelect={() => {
                    setSelectedTenantId(t.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedTenantId === t.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="truncate">{t.nombre}</span>
                    <span className="text-xs text-muted-foreground truncate">{t.slug}</span>
                  </div>
                  {!t.activo && (
                    <Badge variant="outline" className="text-[10px] ml-2">
                      Inactivo
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

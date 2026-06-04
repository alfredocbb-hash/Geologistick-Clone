import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, User, Search, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { normalizePhoneAR } from '@/lib/phoneNormalize';

interface Client {
  id: string;
  nombre: string;
  apellido?: string | null;
  telefono: string;
  email?: string | null;
  direccion: string;
  ciudad?: string | null;
  codigo_postal?: string | null;
  dni_cuit?: string | null;
  tiene_cuenta_corriente?: boolean | null;
  saldo_cuenta_corriente?: number | null;
  limite_credito?: number | null;
  lat?: number | null;
  lng?: number | null;
}

interface ContactAutocompleteProps {
  clients: Client[];
  onSelect: (client: Client) => void;
  placeholder?: string;
  label?: string;
}

export default function ContactAutocomplete({
  clients,
  onSelect,
  placeholder = 'Buscar cliente...',
  label = 'Cargar cliente existente',
}: ContactAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Deduplicate clients: by normalized phone when available (so "Av." vs "Avenida"
  // variants collapse), else fallback to name+address.
  const uniqueClients = useMemo(() => {
    const byPhone = new Map<string, Client>();
    const rest: Client[] = [];

    for (const client of clients) {
      const phone = normalizePhoneAR(client.telefono);
      if (phone) {
        const existing = byPhone.get(phone);
        // Prefer the one with cuenta corriente, then more complete address.
        if (
          !existing ||
          (client.tiene_cuenta_corriente && !existing.tiene_cuenta_corriente) ||
          (client.tiene_cuenta_corriente === existing.tiene_cuenta_corriente &&
            (client.direccion?.length || 0) > (existing.direccion?.length || 0))
        ) {
          byPhone.set(phone, client);
        }
      } else {
        rest.push(client);
      }
    }

    const seen = new Set<string>();
    const deduped = [...byPhone.values()];
    for (const client of rest) {
      const key = `${client.nombre}-${client.apellido || ''}-${client.direccion || ''}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(client);
    }
    return deduped;
  }, [clients]);

  const filteredClients = useMemo(() => {
    if (!search) return uniqueClients.slice(0, 15);
    
    const searchLower = search.toLowerCase();
    return uniqueClients.filter((client) => {
      const fullName = `${client.nombre} ${client.apellido || ''}`.toLowerCase();
      const phone = client.telefono?.toLowerCase() || '';
      const dni = client.dni_cuit?.toLowerCase() || '';
      const email = client.email?.toLowerCase() || '';
      const address = client.direccion?.toLowerCase() || '';
      
      return (
        fullName.includes(searchLower) ||
        phone.includes(searchLower) ||
        dni.includes(searchLower) ||
        email.includes(searchLower) ||
        address.includes(searchLower)
      );
    }).slice(0, 15);
  }, [uniqueClients, search]);

  const handleSelect = (client: Client) => {
    setOpen(false);
    setSearch('');
    // Defer parent callback to let Popover portal unmount first (Chrome fix)
    setTimeout(() => {
      onSelect(client);
    }, 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(value);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-muted-foreground"
        >
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span>{label}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No se encontraron clientes.</CommandEmpty>
            <CommandGroup heading="Clientes">
              {filteredClients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={client.id}
                  onSelect={() => handleSelect(client)}
                  className="flex flex-col items-start py-3"
                >
                  <div className="flex items-center gap-2 w-full">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {client.nombre} {client.apellido || ''}
                    </span>
                    {client.tiene_cuenta_corriente && (
                      <Badge variant="outline" className="ml-auto text-xs bg-primary/10 text-primary border-primary/20">
                        <Wallet className="h-3 w-3 mr-1" />
                        Cta Cte
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-col text-xs text-muted-foreground ml-6 mt-1 gap-0.5">
                    <span>📞 {client.telefono}</span>
                    {client.dni_cuit && <span>🪪 {client.dni_cuit}</span>}
                    {client.direccion && (
                      <span className="truncate max-w-[300px]">
                        📍 {client.direccion}{client.ciudad ? `, ${client.ciudad}` : ''}
                      </span>
                    )}
                    {client.tiene_cuenta_corriente && client.saldo_cuenta_corriente !== null && (
                      <span className="text-primary font-medium">
                        💰 Saldo: {formatCurrency(Number(client.saldo_cuenta_corriente) || 0)}
                        {client.limite_credito ? ` / Límite: ${formatCurrency(client.limite_credito)}` : ''}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

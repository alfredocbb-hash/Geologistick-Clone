
# Fix: Pantalla negra en Envíos + Pérdida de estado al cambiar pestaña

## Causa raíz de la pantalla negra

El error real es un crash en `StatusBadge` (línea 251):

```
TypeError: can't access property "icon", config is undefined
```

Esto ocurre porque `envio.estado_ml` contiene valores de MercadoLibre como `"shipped"` que no existen en `statusConfig`. Cuando se renderiza `<StatusBadge status={envio.estado_ml as ShipmentStatus} />` (línea 482), `statusConfig["shipped"]` es `undefined`, y al intentar acceder a `config.icon` el componente crashea y deja la pantalla en negro.

## Cambios en `src/pages/Shipments.tsx`

### 1. Proteger StatusBadge contra estados desconocidos

Agregar un fallback cuando el estado no existe en `statusConfig`:

```typescript
const StatusBadge = ({ status }: { status: ShipmentStatus }) => {
  const config = statusConfig[status];
  if (!config) {
    return (
      <Badge className="bg-gray-400 text-white gap-1">
        <AlertCircle className="h-3 w-3" />
        {status || 'Desconocido'}
      </Badge>
    );
  }
  const Icon = config.icon;
  return (
    <Badge className={`${config.color} text-white gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};
```

### 2. Controlar Popovers de fecha para cierre automático

Agregar estados `dateFromOpen` y `dateToOpen` y cerrar el Popover al seleccionar fecha:

```typescript
const [dateFromOpen, setDateFromOpen] = useState(false);
const [dateToOpen, setDateToOpen] = useState(false);
```

Aplicar `open` y `onOpenChange` en ambos `<Popover>`, y cerrar en `onSelect`.

### 3. Persistir filtros con `usePersistedState`

Reemplazar `useState` por `usePersistedState` para `search`, `statusFilter`, `dateFrom` y `dateTo`, guardando las fechas como string ISO y parseándolas al usarlas.

## Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Shipments.tsx` | StatusBadge con fallback, Popovers controlados, filtros persistidos |

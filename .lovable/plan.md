

# Plan: Corregir Error RLS y Agregar Google Maps en Terciarizados

## Problemas Identificados

### 1. Error RLS al Crear Envio
El error "new row violates row-level security policy for table 'envios'" ocurre porque el insert en la tabla `envios` no incluye el campo `tenant_id`, el cual es requerido por la politica RLS "Gestionar envios".

**Linea del problema**: `ThirdPartyShipmentsTab.tsx:218-239`

### 2. Falta Autocompletado de Google Maps
El usuario desea usar Google Maps autocomplete para el campo de direccion, similar a como funciona en "Nuevo Envio" y "Sucursales".

---

## Solucion

### Archivo: `src/components/routes/ThirdPartyShipmentsTab.tsx`

#### Cambio 1: Agregar imports necesarios

```typescript
import { AddressAutocomplete, AddressDetails } from '@/components/maps/AddressAutocomplete';
```

#### Cambio 2: Agregar campos lat/lng a la interface

```typescript
interface ThirdPartyFormData {
  // ... campos existentes ...
  entrega_lat: number | null;    // NUEVO
  entrega_lng: number | null;    // NUEVO
}

const emptyForm: ThirdPartyFormData = {
  // ... campos existentes ...
  entrega_lat: null,
  entrega_lng: null,
};
```

#### Cambio 3: Agregar handler para seleccion de direccion

```typescript
const handleAddressSelect = (details: AddressDetails) => {
  setFormData(prev => ({
    ...prev,
    direccion_entrega: details.address || details.formattedAddress,
    ciudad_entrega: details.city || prev.ciudad_entrega,
    provincia: details.province || prev.provincia,
    cp_entrega: details.postalCode || prev.cp_entrega,
    entrega_lat: details.lat,
    entrega_lng: details.lng,
  }));
};
```

#### Cambio 4: Agregar `tenant_id` al insert (FIX CRITICO)

```typescript
.insert({
  tenant_id: profile?.tenant_id,  // AGREGAR - Requerido por RLS
  tracking_number: trackingData,
  // ... resto de campos existentes ...
  entrega_lat: shipment.entrega_lat,  // AGREGAR
  entrega_lng: shipment.entrega_lng,  // AGREGAR
})
```

#### Cambio 5: Reemplazar Input de direccion por AddressAutocomplete

**Antes (lineas 407-414):**
```tsx
<div className="space-y-2">
  <Label>Calle y Numero *</Label>
  <Input
    placeholder="Ej: Av. Corrientes 1234"
    value={formData.direccion_entrega}
    onChange={(e) => handleInputChange("direccion_entrega", e.target.value)}
  />
</div>
```

**Despues:**
```tsx
<AddressAutocomplete
  value={formData.direccion_entrega}
  onChange={(value) => handleInputChange("direccion_entrega", value)}
  onSelect={handleAddressSelect}
  label="Calle y Numero"
  placeholder="Buscar direccion..."
  required
/>
```

---

## Resumen de Cambios

| Seccion | Cambio |
|---------|--------|
| Imports | Agregar `AddressAutocomplete` y `AddressDetails` |
| Interface | Agregar `entrega_lat` y `entrega_lng` |
| Handler | Nuevo `handleAddressSelect` para autocompletar campos |
| Insert RLS | Agregar `tenant_id: profile?.tenant_id` (FIX CRITICO) |
| Insert coords | Agregar `entrega_lat` y `entrega_lng` |
| UI | Reemplazar Input por AddressAutocomplete |

---

## Flujo Despues del Cambio

```text
Usuario escribe direccion
        |
        v
Google Maps Autocomplete sugiere opciones
        |
        v
Usuario selecciona direccion
        |
        v
handleAddressSelect() autocompleta:
  - direccion_entrega
  - ciudad_entrega
  - provincia
  - cp_entrega
  - entrega_lat/lng
        |
        v
Usuario crea envio
        |
        v
Insert incluye tenant_id
        |
        v
RLS valida OK → Envio creado
```

---

## Notas Tecnicas

- El componente `AddressAutocomplete` ya esta disponible en el proyecto y es utilizado en `NewShipment.tsx` y `Branches.tsx`
- El campo `tenant_id` se obtiene de `profile?.tenant_id` que viene del hook `useAuth()`
- Las coordenadas (`entrega_lat`, `entrega_lng`) se almacenan para uso futuro en rutas y mapas


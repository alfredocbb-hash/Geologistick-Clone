

# Plan: Proteger formularios del refetch por cambio de ventana

## Contexto

El plan anterior propuso cambiar el global a `refetchOnWindowFocus: true` para resolver datos obsoletos. Pero esto puede borrar datos temporales en formularios si las queries que alimentan valores por defecto se refrescan y sobrescriben el estado local.

Los formularios ya usan `useFormDraft` (estado local persistido), así que los inputs están protegidos. El riesgo está en queries que cargan datos de referencia (sucursales, tarifas, clientes) que al refrescar podrían causar re-renders innecesarios o resetear selects/autocompletados.

## Cambios

### 1. `src/App.tsx` — Aplicar defaults balanceados

Reducir `staleTime` a 30s y activar `refetchOnWindowFocus: true` globalmente para páginas de listado/dashboard:

```typescript
staleTime: 30 * 1000,
refetchOnWindowFocus: true,
```

### 2. Páginas con formularios — Añadir `refetchOnWindowFocus: false` explícito

En cada `useQuery` de estas páginas/componentes, agregar `refetchOnWindowFocus: false` para que el cambio de foco no dispare refetch mientras el usuario está editando:

- **`src/pages/NewShipment.tsx`** — ~10 queries (sucursales, tarifas, conceptos, clientes, config seguro, caja)
- **`src/pages/Clients.tsx`** — queries de sucursales y clientes
- **`src/pages/Users.tsx`** — queries de tenants, sucursales, profiles
- **`src/pages/Branches.tsx`** — queries de sucursales, tarifa_conceptos, comisiones
- **`src/pages/Vehicles.tsx`** — queries de vehiculos, sucursales, choferes
- **`src/pages/ThirdPartyCompanies.tsx`** — query de empresas
- **`src/components/routes/ThirdPartyShipmentsTab.tsx`** — queries de empresas, envíos, clientes
- **`src/components/ecommerce/CreateSellerDialog.tsx`** — queries de profiles, sucursales, tarifas
- **`src/components/ecommerce/EditSellerDialog.tsx`** — queries de usuarios, sucursales, tarifas
- **`src/components/ecommerce/EditOrderAddressDialog.tsx`** — sin queries propias, OK

### 3. No se requieren cambios en los inputs

Los formularios ya usan `useFormDraft` o `useState` para estado local. Los inputs no leen directamente de queries; las queries solo alimentan selects de referencia (lista de sucursales, tarifas, etc.) que son estables.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | `staleTime: 30s`, `refetchOnWindowFocus: true` |
| `src/pages/NewShipment.tsx` | `refetchOnWindowFocus: false` en cada useQuery |
| `src/pages/Clients.tsx` | ídem |
| `src/pages/Users.tsx` | ídem |
| `src/pages/Branches.tsx` | ídem |
| `src/pages/Vehicles.tsx` | ídem |
| `src/pages/ThirdPartyCompanies.tsx` | ídem |
| `src/components/routes/ThirdPartyShipmentsTab.tsx` | ídem |
| `src/components/ecommerce/CreateSellerDialog.tsx` | ídem |
| `src/components/ecommerce/EditSellerDialog.tsx` | ídem |


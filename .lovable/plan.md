
## Plan: Corrección de Hojas de Ruta y Terminología

---

## 1. Problema: Los choferes no aparecen en el dropdown de Hojas de Ruta

### Causa Identificada
La query de choferes en `RouteSheets.tsx` (líneas 105-128) **no incluye el filtro por tenant_id**, por lo que RLS podría no estar filtrando correctamente. Al verificar la base de datos, hay 4 choferes activos en el tenant "Beraexpress" pero no aparecen en el dropdown.

### Solución
Agregar un filtro explícito por `tenant_id` del usuario actual en la query de choferes:

**Archivo:** `src/pages/RouteSheets.tsx`
```text
const { data: choferes = [] } = useQuery({
  queryKey: ["choferes-activos", profile?.tenant_id],
  queryFn: async () => {
    if (!profile?.tenant_id) return [];
    
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "chofer");
    
    if (rolesError) throw rolesError;
    
    const choferIds = roles?.map(r => r.user_id) || [];
    if (choferIds.length === 0) return [];

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("user_id", choferIds)
      .eq("tenant_id", profile.tenant_id)  // <-- AGREGAR FILTRO
      .eq("activo", true);
    
    if (error) throw error;
    return data;
  },
  enabled: !!profile?.tenant_id,  // <-- HABILITAR SOLO CON TENANT
});
```

Aplicar el mismo cambio en `RoutePlanner.tsx` (líneas 232-256).

---

## 2. Cambiar "En Bodega" por "En Sucursal"

### Contexto
El término "En Bodega" confunde a los usuarios porque en el flujo logístico, cuando un paquete llega a una sucursal (ya sea centro logístico o sucursal destino), el estado debería indicar claramente que está **En Sucursal** listo para ser planificado o despachado.

### Archivos a Modificar (17 archivos)

| Archivo | Ubicación del cambio |
|---------|---------------------|
| `src/pages/Shipments.tsx` | línea 39 |
| `src/pages/Routes.tsx` | línea 238 |
| `src/pages/Drivers.tsx` | línea 192 |
| `src/pages/ScanQR.tsx` | línea 36 |
| `src/pages/Tracking.tsx` | línea 63 |
| `src/pages/TrackingEmbed.tsx` | línea 65 |
| `src/pages/LiveMap.tsx` | líneas 333, 477 |
| `src/components/shipments/ShipmentHistoryDialog.tsx` | línea 39 |
| `src/components/shipments/ChangeStatusDialog.tsx` | línea 55 |
| `src/components/mobile/MobileDeliveriesTab.tsx` | línea 51 |
| `src/lib/generateEPODPDF.ts` | línea 95 |
| `src/lib/generateUserGuidePDF.ts` | línea 84 |

**Cambio en cada archivo:**
```text
Antes:  en_bodega: { label: 'En Bodega', ... }
Después: en_bodega: { label: 'En Sucursal', ... }
```

**Nota:** El valor del estado en la base de datos (`en_bodega`) **NO cambia**, solo la etiqueta visible al usuario.

---

## 3. Ajustes de Lógica en Recepción de Hoja de Ruta

### Flujo Actual (correcto según lo descrito)

```text
1. Sucursal Origen crea envío (estado: pendiente)
2. Sucursal genera Hoja de Ruta hacia Centro Logístico
3. Chofer recolecta (estado: en_transito - hoja)
4. Centro Logístico recibe (estado: en_bodega / ahora "En Sucursal")
5. Centro Logístico puede:
   a) Planificar reparto a puerta (si es entrega a puerta)
   b) Crear otra Hoja de Ruta hacia Sucursal Destino (si es entrega en sucursal)
6. Sucursal Destino recibe (estado: en_bodega / ahora "En Sucursal")
7. Cliente retira (estado: entregado)
```

### Mensaje de historial a mejorar
En `ReceiveRouteSheetDialog.tsx`, el mensaje de historial ya dice "Paquete recibido en sucursal", lo cual es correcto.

En `ReceiveShipmentDialog.tsx` (línea 81), el mensaje dice "Paquete recibido {statusLabel}" donde statusLabel es "en centro logístico" o "en sucursal". Esto es correcto.

---

## Archivos Involucrados

| Archivo | Accion |
|---------|--------|
| `src/pages/RouteSheets.tsx` | Agregar filtro tenant_id a query de choferes |
| `src/pages/RoutePlanner.tsx` | Agregar filtro tenant_id a query de choferes |
| 15+ archivos de UI | Cambiar label "En Bodega" → "En Sucursal" |

---

## Detalles del Cambio de Terminología

### Mapeo de etiquetas (ejemplo)

```text
Antes:
{
  en_bodega: { label: 'En Bodega', color: 'bg-purple-500', icon: Building2 }
}

Después:
{
  en_bodega: { label: 'En Sucursal', color: 'bg-purple-500', icon: Building2 }
}
```

### Lugares específicos a cambiar:

1. **Páginas principales:** Shipments, Routes, Drivers, ScanQR, Tracking, TrackingEmbed, LiveMap
2. **Componentes:** ShipmentHistoryDialog, ChangeStatusDialog, MobileDeliveriesTab
3. **PDFs:** generateEPODPDF, generateUserGuidePDF

---

## Resultado Esperado

1. Los choferes del tenant actual aparecerán correctamente en el dropdown de Hojas de Ruta
2. El estado "en_bodega" se mostrará como "En Sucursal" en toda la aplicación
3. La lógica de recepción entre sucursales funcionará según el flujo esperado



## Plan: Enriquecer API de tracking con hojas de ruta y sucursal detallada (por tenant con API Key)

### Contexto

La Edge Function `public-tracking` ya soporta autenticación por API Key (`x-api-key` header) que identifica al tenant. Cada tenant puede generar sus propias API Keys desde el panel de administración. La API ya filtra por `tenant_id` cuando se usa API Key.

Lo que falta es agregar los nuevos campos de respuesta y mejorar la documentación de uso en el panel.

### Cambios

**1. `supabase/functions/public-tracking/index.ts`** — Agregar queries:

- **Hojas de ruta**: Query `hoja_ruta_envios` → `hojas_ruta` (con joins a `sucursales` para origen/destino) filtrando por `envio_id`. Devolver array con `numero`, `estado`, `fecha_salida`, `origen` (nombre, ciudad), `destino` (nombre, ciudad).
- **Sucursal actual detallada**: Cambiar `sucursal_actual` de string a objeto `{ nombre, ciudad, codigo, es_centro_logistico }` usando los datos ya cargados de las sucursales del envío.

**2. `src/pages/Tracking.tsx`** — Actualizar interfaz `TrackingResponse` con los nuevos campos y renderizar hojas de ruta como cards con badge de estado y origen→destino.

**3. `src/pages/TrackingEmbed.tsx`** — Misma actualización de tipos y renderizado de hojas de ruta.

**4. `src/components/tenants/TenantApiKeysDialog.tsx`** — Mejorar la sección "Ejemplo de uso" con documentación más completa: endpoints disponibles, parámetros, ejemplo de respuesta con los nuevos campos.

### Respuesta API enriquecida (campos nuevos/modificados)

```text
{
  ...campos existentes...,
  "sucursal_actual": {
    "nombre": "Centro Buenos Aires",
    "ciudad": "CABA",
    "codigo": "CBA",
    "es_centro_logistico": true
  },
  "hojas_ruta": [
    {
      "numero": "HR-20250321-0042",
      "estado": "completada",
      "fecha_salida": "2025-03-20T14:30:00Z",
      "cantidad_envios": 15,
      "origen": { "nombre": "Sucursal Norte", "ciudad": "Rosario" },
      "destino": { "nombre": "Centro Buenos Aires", "ciudad": "CABA" }
    }
  ]
}
```

### Seguridad

- Los datos de hojas de ruta solo se devuelven para requests autenticadas (con API Key). Sin API Key, el campo `hojas_ruta` se devuelve vacío.
- La sucursal actual detallada se muestra en ambos modos (público y autenticado).
- Cada tenant solo ve envíos de su propio tenant (ya implementado).

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/public-tracking/index.ts` | Query hojas_ruta + sucursal_actual como objeto |
| `src/pages/Tracking.tsx` | Tipo + UI hojas de ruta |
| `src/pages/TrackingEmbed.tsx` | Tipo + UI hojas de ruta |
| `src/components/tenants/TenantApiKeysDialog.tsx` | Documentación API mejorada |

No requiere migraciones de base de datos.


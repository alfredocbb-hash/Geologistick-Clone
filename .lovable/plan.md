

## Plan: Enriquecer historial en API pública de tracking

### Problema actual

El endpoint `public-tracking` ya devuelve `historial` pero le falta información clave que sí se muestra en el dialog interno (ver imagen):

1. **Nombre del usuario** que realizó el cambio (ej: "Lucas Galarza")
2. **Rutas de reparto** asociadas (`rutas_planificadas`) — solo devuelve hojas de ruta, no rutas de delivery

### Cambios

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/public-tracking/index.ts` | Agregar perfil del usuario al historial y rutas planificadas |

### Detalle del cambio

**Historial enriquecido** (solo para requests con API Key):
- Consultar `profiles` para los `created_by` del historial
- Incluir `usuario` (nombre completo) en cada entrada del historial

**Rutas planificadas**:
- Consultar `ruta_paradas` → `rutas_planificadas` igual que hace `ShipmentHistoryDialog`
- Agregar campo `rutas` al response (junto a `hojas_ruta`)

### Respuesta actualizada del historial

```json
{
  "historial": [
    {
      "estado_anterior": "en_reparto",
      "estado_nuevo": "entregado",
      "notas": "Entregado en domicilio - Entregó: Lucas Galarza",
      "ubicacion": "Berazategui",
      "fecha": "2026-03-19T15:40:00Z",
      "usuario": "Lucas Galarza"
    }
  ],
  "rutas": [
    {
      "numero": "RP-20260319-2457",
      "estado": "completada",
      "tipo": "reparto"
    }
  ],
  "hojas_ruta": [...]
}
```

Para acceso público (sin API Key): `usuario` será `null` y `notas` seguirá oculto.


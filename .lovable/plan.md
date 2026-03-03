

# Plan: Mejoras operativas y protocolo de Check-in obligatorio

## Puntos operativos (no requieren código)

Los primeros 3 puntos son **acciones operativas** que deben realizarse manualmente por el equipo:

1. **Contactar a Lucas Galarza** — Llamar/WhatsApp directamente. Esto no es algo que el sistema pueda hacer automáticamente.
2. **Auditoría de dispositivos GPS** — Revisar físicamente los teléfonos de Kevin Bernard, Valentina Castano y el chofer sin nombre. Verificar que la app esté instalada, permisos de ubicación habilitados, y batería suficiente.
3. **Depurar rutas abandonadas** — Puedo ayudar a cerrar automáticamente rutas viejas no ejecutadas, pero primero necesitaría confirmación de cuáles cerrar.

---

## Feature: Protocolo de Check-in obligatorio (implementable)

### Concepto
Al abrir la app móvil cada día, el chofer debe hacer un **Check-in** que:
- Confirma que está disponible para trabajar
- Fuerza la sincronización de ubicación GPS
- Registra la hora de inicio de jornada
- Alerta al admin si un chofer NO hizo check-in después de cierta hora

### Cambios técnicos

| Componente | Cambio |
|-----------|--------|
| **Nueva tabla** `driver_checkins` | `id`, `chofer_id`, `tenant_id`, `fecha` (date), `checked_in_at` (timestamp), `lat`, `lng`, `accuracy`, `device_info` |
| **`MobileAppLayout.tsx`** | Antes de mostrar el contenido, verificar si el chofer ya hizo check-in hoy. Si no, mostrar pantalla de check-in obligatoria |
| **Nuevo componente** `CheckInScreen.tsx` | Pantalla con botón "Iniciar Jornada" que obtiene ubicación GPS y registra el check-in |
| **`LiveMap.tsx`** | En la tab de choferes, mostrar badge de "Check-in: ✅ 08:15" o "⚠️ Sin check-in" junto a cada chofer |

### Flujo del chofer
1. Abre la app → ve pantalla de Check-in con botón grande "Iniciar Jornada"
2. Toca el botón → se obtiene GPS → se guarda en `driver_checkins`
3. Se actualiza `driver_locations` con la posición actual
4. Se desbloquea la app normal

### Flujo del admin (LiveMap)
- Cada chofer muestra si hizo check-in hoy y a qué hora
- Los choferes sin check-in después de las 9:00 AM aparecen con alerta roja

### Archivos a crear/modificar
- **Crear**: `src/components/mobile/CheckInScreen.tsx`
- **Modificar**: `src/components/mobile/MobileAppLayout.tsx` (agregar guard de check-in)
- **Modificar**: `src/pages/LiveMap.tsx` (mostrar estado de check-in por chofer)
- **Nueva migración**: tabla `driver_checkins` con RLS


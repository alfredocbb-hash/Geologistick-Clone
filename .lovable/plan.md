
# Plan: Limpieza de Datos y Mejora del Mapa en Vivo

## Resumen del Problema

Analizando la base de datos encontré:

| Problema | Detalle |
|----------|---------|
| **Registros huérfanos** | 2 de 6 ubicaciones pertenecen a usuarios sin perfil válido o sin rol de chofer |
| **Sin rutas activas** | 0 rutas en estado `confirmada` o `en_curso` (todas están `completada`) |
| **Historial disponible** | Kevin Bernard tiene historial GPS reciente con 19-45 puntos por ruta |

---

## Fase 1: Limpiar Datos Huérfanos

### 1.1 Eliminar ubicaciones de usuarios inválidos

Se eliminarán registros de `driver_locations` donde:
- El `chofer_id` no tiene perfil en `profiles`
- El `chofer_id` no tiene rol `chofer` en `user_roles`

**Registros a eliminar:**
- `6f51e0c7-3202-4164-a92e-17ce4a52a595` (sin perfil)
- `0defccf3-f154-479d-858c-ff4162d2f91c` (sin rol chofer, usuario "prueba chofer")

---

## Fase 2: Mejorar Filtro en LiveMap

### 2.1 Modificar la consulta de choferes

Actualmente la consulta obtiene TODAS las ubicaciones sin validar roles:

```text
Actual:
  driver_locations → profiles (LEFT JOIN)

Mejorado:
  driver_locations → profiles → user_roles (INNER JOIN where role = 'chofer')
```

### 2.2 Cambios en LiveMap.tsx

La consulta en `queryFn` de "driver-locations" se modificará para:
1. Hacer join con `user_roles` verificando `role = 'chofer'`
2. Filtrar solo choferes activos (con perfil y rol válido)
3. Mostrar indicador si un chofer tiene ruta activa vs historial reciente

---

## Fase 3: Permitir Ver Historial de Rutas Completadas

Dado que actualmente no hay rutas activas, pero sí hay historial GPS, modificaremos la lógica para:

### 3.1 Mostrar última ruta del chofer (activa o completada)

```text
┌─────────────────────────────────────────────────────────────┐
│  CHOFER CON RUTA ACTIVA          CHOFER SIN RUTA ACTIVA    │
│                                                             │
│  🟢 Kevin Bernard                 🟡 Lucas Galarza           │
│  Ruta: RP-20260204-1751          Última ruta: hace 2 días  │
│  Estado: en_curso                 Estado: completada        │
│  [Ver en Mapa]                   [Ver Último Recorrido]    │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Buscar última ruta con historial GPS

Cuando un chofer no tiene ruta activa, buscar la ruta más reciente que tenga registros en `driver_location_history`.

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/LiveMap.tsx` | Mejorar query de choferes + mostrar última ruta si no hay activa |
| Migración SQL | Limpiar registros huérfanos de `driver_locations` |

---

## Detalles Técnicos

### Nueva Consulta de Choferes

```text
1. Obtener ubicaciones de driver_locations
2. JOIN con profiles para nombre/apellido  
3. JOIN con user_roles WHERE role = 'chofer'
4. LEFT JOIN con rutas_planificadas estado = 'en_curso'
5. Si no hay ruta activa, buscar última ruta completada con historial GPS
```

### Indicadores Visuales Mejorados

| Estado | Color | Icono |
|--------|-------|-------|
| Ruta activa | Verde | 🟢 Truck |
| Sin ruta, historial reciente | Amarillo | 🟡 Clock |
| Sin señal (>15min) | Rojo | 🔴 AlertCircle |

---

## Resultado Esperado

Después de implementar:
1. Solo aparecerán los 4 choferes válidos (con perfil + rol)
2. Kevin Bernard mostrará opción "Ver Último Recorrido" con su ruta completada más reciente
3. Se podrá visualizar el historial GPS con gradiente temporal y estadísticas
4. El caché de segmentos funcionará correctamente para rutas históricas


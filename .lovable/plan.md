

## Mejoras propuestas para la pestaña Choferes

Basándome en el código actual, estas son las mejoras más impactantes que se podrían implementar:

---

### 1. Progreso de ruta en tiempo real
Agregar una barra de progreso y contadores (entregados/pendientes/fallidos) en cada tarjeta de chofer con ruta activa. Actualmente solo se muestra el nombre de la ruta, pero no cuántas paradas completó.

### 2. Velocidad actual y estado de movimiento
Mostrar si el chofer está detenido, en movimiento lento o a velocidad normal, usando el campo `speed` que ya se registra en `driver_location_history`. Un badge como "🚛 45 km/h" o "⏸ Detenido 8 min" da contexto inmediato.

### 3. Filtros y ordenamiento
Permitir filtrar choferes por estado (activo/reciente/sin señal) y por si tienen ruta activa o no. Ordenar por última actualización o por progreso de ruta.

### 4. Notificación de chofer detenido demasiado tiempo
Alerta visual automática cuando un chofer con ruta activa lleva más de X minutos sin moverse (configurable). Sin necesidad de pedir análisis IA — detección local comparando posiciones.

### 5. Panel lateral expandible del chofer
Al hacer clic en un chofer, mostrar un panel con: foto/avatar, teléfono (click-to-call), progreso detallado de paradas, tiempo estimado de finalización, y acceso rápido a WhatsApp.

---

### Resumen técnico

| Mejora | Datos necesarios | Complejidad |
|--------|-----------------|-------------|
| Progreso de ruta | Query `ruta_paradas`/`hoja_ruta_envios` + estados envíos | Media |
| Velocidad/movimiento | Campo `speed` de `driver_locations` (ya existe) | Baja |
| Filtros/ordenamiento | Solo UI, datos ya disponibles | Baja |
| Alerta detenido | Comparar posiciones en realtime subscription | Baja |
| Panel lateral expandible | Query adicional perfil + paradas | Media |

Todas las mejoras usan datos que ya existen en la base de datos. No requieren nuevas tablas ni edge functions.


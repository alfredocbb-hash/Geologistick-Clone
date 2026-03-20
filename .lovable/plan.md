

## Plan: Mejoras innovadoras para la APK del chofer

Basado en el analisis completo de la app actual, hay varias areas con funcionalidad basica o botones sin accion. Propongo estas mejoras organizadas por impacto:

---

### 1. Animaciones y transiciones entre pestanas
La app cambia de tab instantaneamente sin transicion. Agregar animaciones de slide/fade entre tabs para una sensacion mas nativa y fluida.

**Archivo:** `MobileAppLayout.tsx`
- Wrappear `renderTabContent()` con un componente de transicion animada (CSS transitions con `translate` y `opacity`)
- Detectar direccion del swipe para animar izquierda/derecha

### 2. Botones de Quick Actions funcionales
Los botones "Historial" y "Reportes" en Home no hacen nada. Conectarlos a sus tabs correspondientes.

**Archivo:** `MobileHomeTab.tsx`
- "Historial" navega a tab history
- "Reportes" muestra un mini-reporte inline (entregas de la semana, porcentaje de exito)

### 3. Racha y gamificacion
Agregar una "racha de dias trabajados" y un sistema de logros simples en el Home y Perfil. Ej: "5 dias consecutivos", "100 entregas", "0 incidentes esta semana". Motiva al chofer y le da feedback positivo.

**Archivos:** `MobileHomeTab.tsx`, `MobileProfileTab.tsx`
- Calcular racha desde `driver_checkins` (dias consecutivos)
- Mostrar badges de logros basados en stats existentes (total entregas, km, etc.)
- Barra de "objetivo del dia" con progreso animado

### 4. Pantalla de Fin de Jornada (Check-out)
Actualmente hay check-in pero no check-out. Agregar una pantalla de cierre de jornada con resumen del dia: entregas, km, ganancias, incidentes, y un boton de "Finalizar Jornada".

**Archivos nuevos:** `CheckOutScreen.tsx`
**Archivos editados:** `MobileProfileTab.tsx`, `MobileAppLayout.tsx`, `useCheckIn.ts`
- Boton "Finalizar Jornada" en perfil
- Resumen con animaciones de numeros incrementando
- Registrar hora de salida en `driver_checkins` (campo `checkout_at`)
- Requiere migracion: agregar columna `checkout_at` a `driver_checkins`

### 5. Mapa mini en Home con ubicacion actual
Mostrar un mini-mapa en el Home con la ubicacion actual del chofer y la proxima parada marcada. Da contexto visual inmediato sin entrar a la ruta.

**Archivo:** `MobileHomeTab.tsx`
- Componente Google Maps embebido pequeno (150px alto) 
- Marcador del chofer + marcador de proxima parada
- Click para expandir/ir a ruta activa

### 6. Notificaciones con sonido y vibracion nativa
Cuando llega una notificacion, vibrar el dispositivo y reproducir un sonido corto.

**Archivo:** `useNotifications.ts`
- Usar `navigator.vibrate()` para vibracion
- Reproducir un audio corto al recibir notificacion nueva

### 7. Splash screen mejorada con animacion
La splash actual es estatica. Agregar animacion de logo con scale+fade y un loading progress bar.

**Archivo:** `MobileAppLayout.tsx`
- Logo con animacion `scale(0.8) -> scale(1)` + fade in
- Progress bar animada debajo

---

### Resumen tecnico

| Mejora | Archivos | Migracion DB |
|--------|----------|-------------|
| Transiciones entre tabs | `MobileAppLayout.tsx` | No |
| Quick Actions funcionales | `MobileHomeTab.tsx` | No |
| Racha y gamificacion | `MobileHomeTab.tsx`, `MobileProfileTab.tsx` | No |
| Check-out / Fin de Jornada | Nuevo `CheckOutScreen.tsx`, editar 3 archivos | Si: `checkout_at` en `driver_checkins` |
| Mini-mapa en Home | `MobileHomeTab.tsx` | No |
| Vibracion en notificaciones | `useNotifications.ts` | No |
| Splash animada | `MobileAppLayout.tsx` | No |

La mayoria de las mejoras usan datos que ya existen. Solo el check-out requiere una migracion simple (1 columna).



# Plan: Limpieza de Datos y Mejora del Mapa en Vivo

## ✅ COMPLETADO

### Fase 1: Limpiar Datos Huérfanos
- [x] Eliminadas ubicaciones de `driver_locations` de usuarios sin perfil o sin rol 'chofer'

### Fase 2: Mejorar Filtro en LiveMap  
- [x] Consulta modificada para hacer JOIN con `user_roles` verificando `role = 'chofer'`
- [x] Solo aparecen choferes válidos con perfil y rol activo

### Fase 3: Ver Historial de Rutas Completadas
- [x] Agregada propiedad `ultima_ruta` en DriverLocation
- [x] Consulta busca última ruta completada con historial GPS para choferes sin ruta activa
- [x] Botón "Ver último recorrido" visible cuando hay historial disponible

---

## Resultado

El Mapa en Vivo ahora:
1. Solo muestra choferes con rol 'chofer' válido
2. Muestra "Ver en mapa" para rutas activas (en_curso)
3. Muestra "Ver último recorrido" para choferes sin ruta activa pero con historial GPS
4. Visualiza recorrido calle por calle con snap-to-roads



# Plan: Aumentar Frecuencia de Tracking a 30 Segundos

## Situación Actual

El archivo `src/hooks/useGeolocation.ts` tiene dos intervalos:

| Intervalo | Valor Actual | Propósito |
|-----------|--------------|-----------|
| `updateInterval` (línea 26) | 30 segundos | Actualizar posición actual en `driver_locations` |
| Historial (línea 65) | 60 segundos | Guardar en `driver_location_history` |

El intervalo de historial sigue en 60 segundos, que es el que afecta la precisión de las rutas.

---

## Cambio Requerido

Modificar la línea 65 de `src/hooks/useGeolocation.ts`:

**Antes:**
```typescript
if (now - lastHistoryUpdateRef.current >= 60000) { // 60 seconds
```

**Después:**
```typescript
if (now - lastHistoryUpdateRef.current >= 30000) { // 30 seconds
```

---

## Archivo a Modificar

| Archivo | Línea | Cambio |
|---------|-------|--------|
| `src/hooks/useGeolocation.ts` | 65 | Cambiar `60000` a `30000` |

---

## Impacto

- **Más datos:** El doble de puntos GPS por minuto
- **Rutas más precisas:** Menos interpolación necesaria con Snap to Roads
- **Más almacenamiento:** Aproximadamente 2x más registros en `driver_location_history`
- **Mejor trazabilidad:** Recorridos más detallados calle por calle

---

## Prueba de Funcionamiento

Para verificar que funciona correctamente:

1. Inicia sesión como chofer
2. Activa una ruta
3. Muévete durante 2-3 minutos
4. Verifica en el Mapa en Vivo que los puntos se registren cada 30 segundos
5. Al ver el historial de recorrido, debería haber más puntos y la ruta snap-to-roads más detallada


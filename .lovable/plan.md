

## Modo Colecta Rapida

### Que es
Una nueva pantalla de escaneo masivo orientada a la **colecta/retiro** de paquetes (ML Flex u otras plataformas). Similar al Modo Flex en la experiencia de escaneo continuo, pero con una diferencia clave:

- **Modo Flex**: escanea, autoasigna, y luego inicia reparto (entrega)
- **Modo Colecta**: escanea, agrupa, y confirma el retiro de todos juntos

### Flujo del usuario

1. El chofer abre "Colecta Rapida" desde la pantalla de escaneo
2. Escanea paquetes continuamente (QR de ML u otros) — se van acumulando en una lista con contador
3. Ve la lista de paquetes escaneados con tracking, destinatario y direccion
4. Puede quitar paquetes individuales si se equivoco
5. Presiona **"CONFIRMAR COLECTA"** que cambia todos los envios a `recogido` / `estado_retiro: retirado` en lote
6. Se registra el historial para cada envio

### Diferencias con Modo Flex

| Aspecto | Modo Flex | Modo Colecta |
|---|---|---|
| Proposito | Autoasignar + repartir | Solo retirar/colectar |
| Estado resultante | `en_reparto` | `recogido` |
| Crea ruta | Si | No |
| Navegacion post-accion | Va a ruta activa | Vuelve a pantalla de escaneo |
| Boton principal | "INICIAR REPARTO" | "CONFIRMAR COLECTA (N)" |

### Cambios tecnicos

**1. Nuevo componente: `src/components/mobile/CollectScanScreen.tsx`**
- Reutiliza el patron de `FlexScanScreen` para el escaneo continuo
- Lista de paquetes acumulados con contador
- Boton "CONFIRMAR COLECTA" que ejecuta un update en lote
- Al confirmar:
  - Actualiza `envios` SET `estado = 'recogido'`, `estado_retiro = 'retirado'`, `fecha_recogida = now()`, `chofer_id = usuario actual`
  - Inserta registros en `envio_historial` para cada paquete
- Muestra toast de exito con cantidad confirmada y limpia la lista

**2. Nuevo hook: `src/hooks/useCollectPackages.ts`**
- Similar a `useFlexPackages` pero simplificado (sin geocodificacion, sin optimizacion de ruta)
- Funciones: `addPackageByTracking`, `removePackage`, `clearPackages`, `confirmCollection`
- `confirmCollection` hace el update masivo de estado + historial

**3. Integracion en `MobileScanTab.tsx`**
- El boton "Colectar" existente (linea 491) abre la nueva pantalla `CollectScanScreen` en lugar del escaner individual
- Se agrega un estado para mostrar/ocultar la pantalla de colecta

**4. Sin cambios en base de datos**
- Usa los mismos campos existentes (`estado`, `estado_retiro`, `fecha_recogida`, `chofer_id`)
- Usa la misma tabla `envio_historial` para el registro

### Experiencia de usuario

- Pantalla oscura estilo mobile con contador grande "N paquetes escaneados"
- Escaneo continuo con feedback haptico/sonoro (igual que Flex)
- Lista scrolleable de paquetes con tracking y datos basicos
- Boton verde grande "CONFIRMAR COLECTA (N)" al fondo
- Al confirmar, muestra resumen y vuelve a la pantalla de escaneo

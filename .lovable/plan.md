
# Plan: Causa raiz encontrada - Configuracion de Capacitor y bugs del scanner

## Problema Principal (CAUSA RAIZ)

El archivo `capacitor.config.ts` **NO tiene configurado `server.url`**. Esto significa que la APK carga la interfaz web desde los archivos empaquetados dentro del APK (la carpeta `dist/`), **NO desde la URL publicada**.

```text
// Configuracion actual (sin server.url):
appId: 'com.geologic.choferapp'
webDir: 'dist'          <-- Carga archivos LOCALES del APK
// NO hay server.url    <-- Los cambios web NUNCA llegan al dispositivo
```

Por eso el usuario no ve ningun cambio: todos los fixes que hicimos (dialog persistence, route activation, map markers, etc.) estan en el codigo web publicado, pero la APK sigue usando el codigo viejo empaquetado al momento de compilarla.

---

## Solucion (2 partes)

### Parte 1: Configurar `server.url` en `capacitor.config.ts`

Agregar la URL publicada al config para que la APK cargue el contenido desde la web en lugar de los archivos locales. Esto requiere **una ultima reconstruccion** de la APK, pero despues de eso, todos los cambios futuros estaran disponibles automaticamente al publicar.

```text
// Configuracion corregida:
server: {
  url: "https://geologic.lovable.app?forceHideBadge=true",
  cleartext: true
}
```

**Impacto**: Despues de reconstruir la APK con este cambio, el usuario nunca mas necesitara actualizar la APK para ver cambios de codigo. Solo necesitara Publicar los cambios aqui.

### Parte 2: Corregir el QRScanner (auto-inicio en Android)

Hay un bug independiente en el componente `QRScanner.tsx`: cuando se detecta Android nativo, el scanner cambia a modo web pero **no se inicia automaticamente**. En su lugar, muestra un boton "Activar camara" que el usuario tiene que tocar manualmente cada vez. Esto es lo que el usuario percibe como "pide permiso cada vez".

**El flujo actual (problematico):**

```text
[Usuario abre scanner]
  -> Android detectado, forzar modo web
  -> setForceWebScanner(true)
  -> Muestra boton "Activar camara"      <-- PROBLEMA: paso manual innecesario
  -> Usuario toca boton
  -> getUserMedia() pide permiso
  -> Scanner arranca
```

**El flujo corregido:**

```text
[Usuario abre scanner]
  -> Android detectado, forzar modo web
  -> setForceWebScanner(true) + setWebStarted(true)
  -> Auto-iniciar web scanner inmediatamente
  -> getUserMedia() pide permiso (solo la primera vez, luego recuerda)
  -> Scanner arranca automaticamente
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `capacitor.config.ts` | Agregar `server.url` apuntando a la URL publicada |
| `src/components/qr/QRScanner.tsx` | Auto-iniciar el web scanner en Android sin paso manual; usar ref para callback de scan para evitar closures obsoletos |

---

## Detalle Tecnico

### 1. `capacitor.config.ts`

Agregar la seccion `server` con la URL publicada:

```typescript
const config: CapacitorConfig = {
  appId: 'com.geologic.choferapp',
  appName: 'ChoferApp',
  webDir: 'dist',
  server: {
    url: "https://geologic.lovable.app?forceHideBadge=true",
    cleartext: true,
  },
  plugins: { /* sin cambios */ }
};
```

### 2. `QRScanner.tsx` - Auto-inicio del web scanner

**Cambio 1**: En el `useEffect` principal (linea 147), cuando se detecta Android y se fuerza modo web, tambien iniciar el scanner automaticamente:

```typescript
if (shouldStartWithWeb && !forceWebScanner) {
  setForceWebScanner(true);
  setWebStarted(true);   // <-- NUEVO: marcar como iniciado
  setIsLoading(true);     // <-- NUEVO: mostrar loading mientras arranca
  // Auto-iniciar despues de que el DOM se actualice
  setTimeout(() => initWebScanner(), 200);
}
```

**Cambio 2**: Agregar una ref para el callback `onScan` para evitar closures obsoletos en modo continuo:

```typescript
const onScanRef = useRef(onScan);
useEffect(() => { onScanRef.current = onScan; }, [onScan]);
```

Y usar `onScanRef.current(decodedText)` en lugar de `onScan(decodedText)` en los callbacks del scanner, tanto en el web scanner como en el nativo. Esto asegura que el callback siempre sea el mas actualizado, evitando que el scanner use funciones obsoletas despues de re-renders.

**Cambio 3**: Remover el toast de diagnostico que se muestra cada vez que se abre el scanner (linea 160: `toast.info('Plataforma: ...')`), ya que es solo para debug y molesta en produccion.

---

## Pasos para el usuario despues de los cambios

1. **Publicar** los cambios aqui en Lovable
2. Hacer `git pull` en el proyecto local
3. Ejecutar `npm install && npm run build && npx cap sync`
4. Reconstruir la APK con `npx cap run android`
5. Instalar la nueva APK en el dispositivo
6. A partir de ahora, cada vez que se publique un cambio, la app lo cargara automaticamente sin necesidad de actualizar la APK

---

## Por que esto resuelve TODOS los problemas reportados

| Problema | Por que ocurre | Como se resuelve |
|----------|---------------|-----------------|
| Scanner pide permiso cada vez | APK tiene codigo viejo + boton manual "Activar camara" | Auto-inicio del scanner + APK carga codigo actualizado |
| Scanner se cierra despues de escanear | APK tiene codigo viejo sin fix de continuousMode | APK carga codigo actualizado con todos los fixes |
| Foto de entrega vuelve a pagina principal | APK no tiene la persistencia de dialog state | APK carga codigo actualizado con sessionStorage |
| No deja marcar como entregado | Dialog no se reabre despues del reload del WebView | Persistencia de dialog state ya implementada |
| Cambios futuros no se ven | APK carga desde dist/ local | APK carga desde URL publicada |

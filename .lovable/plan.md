

# Plan: Verificar y Mejorar Fotos, Firmas y Mapa en EPOD

## Problema Identificado

### 1. Bucket de Storage Privado (CRITICO)
El bucket `delivery-photos` esta configurado como **privado** (`public: false`), lo que significa que:
- Las URLs generadas con `getPublicUrl()` **no funcionaran** para usuarios no autenticados
- Las imagenes no se mostraran correctamente en el EPOD (que intenta cargar las imagenes via fetch)
- La visualizacion en el dialogo de detalles podria fallar en ciertos contextos

**Solucion**: Hacer el bucket publico para que las fotos y firmas sean accesibles.

### 2. Mapa Estatico en EPOD (MEJORA)
Actualmente el EPOD solo muestra:
- Coordenadas GPS como texto
- Un enlace a Google Maps

El usuario solicito que se incluya **una imagen de mapa** con la geolocalizacion de la entrega.

**Solucion**: Agregar un mapa estatico de Google Maps en el EPOD.

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| Nueva migracion SQL | Hacer el bucket `delivery-photos` publico |
| `src/lib/generateEPODPDF.ts` | Agregar mapa estatico con la ubicacion GPS |

---

## Cambios Tecnicos

### 1. Migracion SQL: Hacer Bucket Publico

```sql
UPDATE storage.buckets 
SET public = true 
WHERE name = 'delivery-photos';
```

### 2. Agregar Mapa Estatico en EPOD

Modificar `generateEPODPDF.ts` para:

1. Cargar imagen de mapa estatico desde Google Static Maps API
2. Mostrar el mapa junto a las coordenadas GPS
3. Mantener el enlace a Google Maps como respaldo

```text
ANTES (solo texto):
+--------------------------------+
| [GPS] Ubicacion:               |
| -34.123456, -58.654321         |
| maps.google.com/?q=...         |
+--------------------------------+

DESPUES (con mapa):
+--------------------------------+
| [GPS] Ubicacion de Entrega     |
| -34.123456, -58.654321         |
+--------------------------------+
| [IMAGEN DEL MAPA ESTATICO]     |
| (marcador en la ubicacion)     |
+--------------------------------+
| Ver en Google Maps: link       |
+--------------------------------+
```

### Implementacion del Mapa Estatico

```typescript
// Generar URL del mapa estatico
const generateStaticMapUrl = (lat: number, lng: number, apiKey: string): string => {
  return `https://maps.googleapis.com/maps/api/staticmap?` +
    `center=${lat},${lng}` +
    `&zoom=16` +
    `&size=400x200` +
    `&markers=color:red%7C${lat},${lng}` +
    `&key=${apiKey}`;
};

// Cargar el mapa junto con foto y firma
const [photoBase64, signatureBase64, mapBase64] = await Promise.all([
  envio.foto_entrega ? loadImageAsBase64(envio.foto_entrega) : null,
  envio.firma_destinatario ? loadImageAsBase64(envio.firma_destinatario) : null,
  (envio.entrega_lat && envio.entrega_lng) 
    ? loadStaticMapImage(envio.entrega_lat, envio.entrega_lng) 
    : null,
]);
```

### Obtencion de API Key

El mapa estatico requiere la Google Maps API Key. Opciones:

1. **Usar Edge Function existente** (`get-maps-config`): Llamar desde el frontend antes de generar el EPOD
2. **Pasar API Key como parametro**: La funcion `generateEPODPDF` recibe la key opcionalmente
3. **Fallback sin mapa**: Si no hay API Key, mostrar solo coordenadas (comportamiento actual)

---

## Flujo de Verificacion Actual

```text
CAPTURA DE EVIDENCIA
1. Chofer confirma entrega en app movil
2. GPS se captura automaticamente via navigator.geolocation
3. Foto se toma con camara del dispositivo
4. Firma se dibuja en canvas
5. Todo se sube a bucket "delivery-photos"
6. URLs se guardan en tabla "envios"

VISUALIZACION
1. Usuario abre detalle del envio
2. Tab "Evidencia" muestra:
   - Ubicacion GPS con boton "Ver en Mapa"
   - Foto de entrega (clickeable)
   - Firma del destinatario (clickeable)

GENERACION EPOD
1. Usuario hace clic en "EPOD"
2. Sistema carga foto y firma via fetch
3. Se genera PDF con toda la evidencia
4. PDF se descarga automaticamente
```

---

## Resultado Esperado

| Elemento | Estado Actual | Despues del Cambio |
|----------|--------------|-------------------|
| Fotos en UI | Podrian fallar (bucket privado) | Funcionan correctamente |
| Firmas en UI | Podrian fallar (bucket privado) | Funcionan correctamente |
| Fotos en EPOD | Podrian fallar al cargar | Cargan correctamente |
| Firmas en EPOD | Podrian fallar al cargar | Cargan correctamente |
| Mapa en EPOD | Solo texto/coordenadas | Imagen de mapa estatico |
| GPS en EPOD | Coordenadas + link | Coordenadas + mapa + link |

---

## Consideraciones de Seguridad

Hacer el bucket publico significa que cualquiera con la URL puede ver las fotos. Sin embargo:
- Las URLs son dificiles de adivinar (incluyen UUID del envio + timestamp)
- Las fotos de entrega no contienen informacion sensible adicional
- Es el comportamiento estandar para sistemas de EPOD

Si se prefiere mantener el bucket privado, se deberia usar **signed URLs** en lugar de public URLs, lo cual requiere cambios mas extensos en el flujo de carga y visualizacion.


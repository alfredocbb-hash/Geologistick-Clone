

## Plan: Conectar OCR Masivo con Colecta del chofer

### Problema
Cuando el chofer abre "OCR Masivo" desde Colecta Rapida, el `BulkOCRScreen` se monta sin `onPackagesReady`. Al terminar el OCR y pulsar "PLANIFICAR", navega al route-planner en vez de agregar los paquetes a la lista de colecta. No hay boton "Colectar" visible.

### Solucion

**Archivo: `src/components/mobile/CollectScanScreen.tsx`** (linea 289)

Pasar `onPackagesReady` al `BulkOCRScreen` para que cuando el chofer termine el OCR y pulse el boton, los paquetes se agreguen a la lista de colecta:

```tsx
<BulkOCRScreen 
  onClose={() => setShowBulkOCR(false)}
  onPackagesReady={async (ids: string[]) => {
    setShowBulkOCR(false);
    for (const id of ids) {
      const { data } = await supabase
        .from('envios')
        .select('tracking_number')
        .eq('id', id)
        .single();
      if (data?.tracking_number) {
        await addPackageByTracking(data.tracking_number);
      }
    }
  }}
/>
```

**Archivo: `src/components/mobile/BulkOCRScreen.tsx`**

Cuando `onPackagesReady` esta presente (viene de Colecta), cambiar el texto del boton de "PLANIFICAR" a "COLECTAR" para que el chofer entienda que esta confirmando colecta, no planificando ruta. Cambios en 3 lugares donde aparece el boton:
- Linea ~634: `PLANIFICAR ({savedCount})` → `COLECTAR ({savedCount})`
- Linea ~809: `PLANIFICAR RUTA ({packages.length})` → `COLECTAR ({packages.length})`
- Icono: cambiar `Route` por `Package` cuando hay `onPackagesReady`

### Resultado
1. Chofer abre Colecta Rapida → OCR Masivo → toma fotos → se procesan
2. Pulsa "COLECTAR (N)" → los paquetes aparecen en la lista de colecta
3. Pulsa "CONFIRMAR COLECTA" → se actualizan a `recogido` con `chofer_id` y se crea registro en `colectas`

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/mobile/CollectScanScreen.tsx` | Pasar `onPackagesReady` al `BulkOCRScreen` |
| `src/components/mobile/BulkOCRScreen.tsx` | Texto del boton condicional: "COLECTAR" vs "PLANIFICAR" |




# Plan: Agregar Opción "Recibir Hoja de Ruta" en la APK

## Problema Identificado

Cuando un usuario con rol de **administración/operador/sucursal** escanea una Hoja de Ruta, el sistema detecta el código pero solo muestra una notificación sin realizar ninguna acción. Esto se debe a que:

1. El escaneo detecta correctamente el tipo `route_sheet`
2. Pero la lógica actual (líneas 95-101) solo muestra un toast informativo
3. No se invoca el diálogo `ReceiveRouteSheetDialog` que ya existe

## Solución Propuesta

Agregar una **tercera opción de escaneo** llamada "Recibir Despachos" y habilitar la lógica para procesar hojas de ruta según el rol del usuario:

```text
Opciones actuales:          Opciones nuevas:
┌─────────┬─────────┐       ┌─────────┬─────────┬─────────┐
│Colectar │ Entregar│  -->  │Colectar │ Entregar│ Recibir │
│(chofer) │(chofer) │       │(chofer) │(chofer) │ (admin) │
└─────────┴─────────┘       └─────────┴─────────┴─────────┘
```

## Cambios a Implementar

### 1. Agregar estado para el diálogo de recepción de hoja de ruta

```typescript
// Nuevos estados
const [showReceiveRouteSheetDialog, setShowReceiveRouteSheetDialog] = useState(false);
const [scannedRouteSheetId, setScannedRouteSheetId] = useState<string | null>(null);
```

### 2. Modificar la lógica cuando se detecta una hoja de ruta

Cuando `parsed.type === 'route_sheet'`:
- Si el usuario es **chofer**: mostrar `CollectRouteSheetDialog` (para recolectar)
- Si el usuario es **operador/admin/sucursal**: mostrar `ReceiveRouteSheetDialog` (para recibir)

```typescript
if (parsed.type === 'route_sheet') {
  const hojaId = parsed.value;
  
  // Buscar la hoja de ruta en la base de datos
  const { data: hojaRuta } = await supabase
    .from('hojas_ruta')
    .select('id, estado, chofer_id')
    .eq('id', hojaId)
    .single();
  
  if (!hojaRuta) {
    toast.error('Hoja de ruta no encontrada');
    return;
  }
  
  setScannedRouteSheetId(hojaId);
  
  if (hasRole('chofer')) {
    setShowCollectRouteSheetDialog(true);
  } else {
    setShowReceiveRouteSheetDialog(true);
  }
  return;
}
```

### 3. Agregar tercera tarjeta de acción rápida (condicional por rol)

Para usuarios **NO chofer** (admin, operador, sucursal), mostrar la opción "Recibir":

```tsx
{/* Solo mostrar para roles de sucursal/operador */}
{(hasRole('operador') || hasRole('bodega') || hasRole('sucursal') || hasRole('admin')) && (
  <Card 
    className="bg-slate-900/60 border-slate-800/50 cursor-pointer hover:border-purple-500/50"
    onClick={handleScanClick}
  >
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/10 flex items-center justify-center">
          <Building2 className="h-6 w-6 text-purple-400" />
        </div>
        <div>
          <p className="font-semibold text-white">Recibir</p>
          <p className="text-xs text-slate-400">Hoja de ruta</p>
        </div>
      </div>
    </CardContent>
  </Card>
)}
```

### 4. Agregar los diálogos al render

```tsx
{/* Receive Route Sheet Dialog */}
{showReceiveRouteSheetDialog && scannedRouteSheetId && (
  <ReceiveRouteSheetDialog
    hojaRutaId={scannedRouteSheetId}
    onClose={handleDialogClose}
  />
)}

{/* Collect Route Sheet Dialog (for drivers) */}
{showCollectRouteSheetDialog && scannedRouteSheetId && (
  <CollectRouteSheetDialog
    hojaRutaId={scannedRouteSheetId}
    onClose={handleDialogClose}
    onSuccess={handleDialogSuccess}
  />
)}
```

## Archivo a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/mobile/MobileScanTab.tsx` | Agregar lógica para hojas de ruta + tercera tarjeta + diálogos |

## Flujo Resultante

```text
Usuario escanea QR
        │
        ▼
┌─────────────────────────────────┐
│    ¿Qué tipo de código es?      │
└─────────────────────────────────┘
        │
   ┌────┼────┬─────────────────┐
   │    │    │                 │
   ▼    ▼    ▼                 ▼
Envío  HR   ML            Desconocido
   │    │    │                 │
   │    │    │                 ▼
   │    │    │           Toast error
   │    │    │
   │    │    ▼
   │    │  Buscar/Registrar ML
   │    │
   │    ▼
   │ ┌──────────────────────────┐
   │ │  ¿Rol del usuario?       │
   │ └──────────────────────────┘
   │         │
   │    ┌────┴────┐
   │    ▼         ▼
   │  Chofer    Admin/Operador
   │    │         │
   │    ▼         ▼
   │ Collect   Receive
   │ Dialog    Dialog
   │
   ▼
Dialogs según estado/rol actual
```

## Resultado Esperado

1. Al escanear una **Hoja de Ruta** como administrador/operador → se abre el diálogo de **recepción masiva**
2. Al escanear una **Hoja de Ruta** como chofer → se abre el diálogo de **recolección**
3. Nueva tarjeta "Recibir" visible solo para roles de sucursal/operador
4. Escaneo de envíos individuales sigue funcionando igual


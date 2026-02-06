

# Plan: Modo Flex Completo con Transferencia Automática

## Resumen

Implementar un "Modo Flex" configurable por empresa que transforma la experiencia móvil en un flujo simplificado estilo MercadoLibre Flex:

- **Escaneo múltiple**: Acumular paquetes en una lista antes de iniciar reparto
- **Vista de mapa**: Ver todas las paradas con marcadores numerados
- **Optimización GPS**: Reordenar paradas según ubicación actual del chofer
- **Transferencia automática**: Si un chofer escanea un paquete asignado a otro, se transfiere automáticamente

## Decisiones de Diseño (según tus respuestas)

| Aspecto | Comportamiento |
|---------|---------------|
| **Asignación** | Híbrido - Choferes auto-asignan, operadores pueden reasignar |
| **Conflictos** | Transferencia automática sin preguntar al escanear |

---

## Cambios en Base de Datos

Agregar columna `modo_flex` a la tabla `tenants`:

```sql
ALTER TABLE tenants ADD COLUMN modo_flex boolean DEFAULT false;
COMMENT ON COLUMN tenants.modo_flex IS 
  'Habilita interfaz simplificada estilo ML Flex para operación de última milla';
```

---

## Arquitectura de Componentes

```text
                    MobileAppLayout
                          |
            ┌─────────────┴─────────────┐
            │                           │
    tenant.modo_flex?                   │
            │                           │
     ┌──────┴──────┐                    │
     ▼             ▼                    ▼
FlexScanScreen  MobileScanTab      (otros tabs)
     │
     ├── useFlexPackages (hook de estado)
     ├── FlexPackageList (lista acumulada)
     ├── FlexMapPreview (mapa con paradas)
     └── Botones: Optimizar / Iniciar Reparto
             │
             ▼
    ActiveRouteNavigation (componente existente)
```

---

## Archivos a Crear

### 1. `src/hooks/useFlexPackages.ts`
Hook para manejar el estado de paquetes acumulados en modo Flex.

**Funcionalidades:**
- Agregar/remover paquetes de la lista
- Persistir en `sessionStorage` (para no perder al cambiar tabs)
- Calcular orden optimizado (nearest-neighbor desde GPS actual)
- Crear `ruta_planificada` al iniciar reparto

**Lógica de transferencia automática:**
```typescript
// Al escanear un paquete asignado a otro chofer
if (envio.chofer_id && envio.chofer_id !== userId) {
  // Transferir automáticamente sin preguntar
  await supabase.from('envios').update({
    chofer_id: userId,
    chofer_ultima_milla_id: userId,
    fecha_asignacion_ultima_milla: new Date().toISOString()
  }).eq('id', envio.id);
  
  // Registrar en historial
  await supabase.from('envio_historial').insert({
    envio_id: envio.id,
    estado_anterior: envio.estado,
    estado_nuevo: envio.estado,
    notas: `Transferido automáticamente de ${choferAnterior} a ${choferActual}`,
    created_by: userId
  });
}
```

### 2. `src/components/mobile/FlexScanScreen.tsx`
Pantalla principal de escaneo para modo Flex.

**Diseño de UI:**
```text
┌─────────────────────────────────────────┐
│            MODO FLEX                    │
├─────────────────────────────────────────┤
│                                         │
│     ┌─────────────────────────────┐     │
│     │      ESCANEAR PAQUETE       │     │
│     │        [BOTÓN GRANDE]       │     │
│     └─────────────────────────────┘     │
│                                         │
│   Paquetes: 5                   [Limpiar]│
│   ┌─────────────────────────────────┐   │
│   │ 1. ML-42012345  Corrientes 1234 │   │
│   │ 2. BB-A2F54D    Belgrano 100    │   │
│   │ 3. BB-C3D77E    25 de Mayo 200  │   │
│   └─────────────────────────────────┘   │
│                                         │
│   ┌──────────┐  ┌──────────┐           │
│   │ VER MAPA │  │ INICIAR  │           │
│   │          │  │ REPARTO  │           │
│   └──────────┘  └──────────┘           │
└─────────────────────────────────────────┘
```

**Flujo de escaneo:**
1. Usuario toca "Escanear"
2. Se abre el QR Scanner existente
3. Al detectar código:
   - Si existe en BD → agregar a lista (transferir si es de otro chofer)
   - Si no existe (QR ML) → mostrar `MLRegisterDialog` para auto-registro
4. Repetir hasta tener todos los paquetes

### 3. `src/components/mobile/FlexMapPreview.tsx`
Vista previa del mapa antes de iniciar reparto.

**Funcionalidades:**
- Mostrar marcadores numerados para cada parada
- Mostrar ubicación actual del chofer (GPS)
- Botón "Optimizar" que reordena según distancia
- Integra con `MapView` existente

### 4. `src/components/scan/TransferFlexPackagesDialog.tsx`
Diálogo para operadores/admins que quieren asignar paquetes a un chofer específico.

**UI:**
```text
┌─────────────────────────────────────────┐
│     ASIGNAR PAQUETES A CHOFER           │
├─────────────────────────────────────────┤
│                                         │
│   Seleccionar chofer:                   │
│   ┌─────────────────────────────────┐   │
│   │ ▼  Juan Pérez (en línea)        │   │
│   └─────────────────────────────────┘   │
│                                         │
│   Se asignarán 5 paquetes.              │
│   El chofer los verá en "Mis Rutas".    │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │      CONFIRMAR ASIGNACIÓN       │   │
│   └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

---

## Archivos a Modificar

### 1. `src/hooks/useTenant.ts`
Agregar `modo_flex` al tipo `Tenant`:

```typescript
export interface Tenant {
  // ... campos existentes
  modo_flex?: boolean;
}
```

### 2. `src/components/tenants/EditTenantDialog.tsx`
Agregar switch para activar Modo Flex:

```typescript
<div className="flex items-center justify-between rounded-lg border p-4">
  <div>
    <Label className="text-base font-medium">Modo Flex</Label>
    <p className="text-sm text-muted-foreground">
      Interfaz simplificada para operación de última milla
    </p>
  </div>
  <Switch 
    checked={modoFlexEnabled} 
    onCheckedChange={setModoFlexEnabled} 
  />
</div>
```

### 3. `src/components/mobile/MobileAppLayout.tsx`
Detectar modo Flex y renderizar la pantalla correspondiente:

```typescript
const { tenant } = useTenant();

const renderTabContent = () => {
  // Si es modo Flex y está en tab de escaneo, mostrar FlexScanScreen
  if (tenant?.modo_flex && activeTab === 'scan') {
    return <FlexScanScreen />;
  }
  
  // Resto de tabs normales
  switch (activeTab) {
    // ...
  }
};
```

### 4. `src/components/mobile/MobileBottomNav.tsx`
Simplificar navegación en modo Flex (ocultar tabs innecesarios):

```typescript
// En modo Flex, solo mostrar: Inicio, Escanear, Rutas, Perfil
const flexTabs = ['home', 'scan', 'routes', 'profile'];
const visibleTabs = tenant?.modo_flex ? flexTabs : allTabs;
```

---

## Flujo de Transferencia Automática

```text
┌────────────────────────────────────────────────────────────┐
│            CHOFER B ESCANEA PAQUETE DE CHOFER A           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1. Chofer B escanea QR                                    │
│         │                                                  │
│         ▼                                                  │
│  2. Sistema detecta: envio.chofer_id = Chofer A           │
│         │                                                  │
│         ▼                                                  │
│  3. TRANSFERENCIA AUTOMÁTICA (sin preguntar)               │
│     • envio.chofer_id = Chofer B                           │
│     • envio.chofer_ultima_milla_id = Chofer B              │
│     • Registrar en historial                               │
│         │                                                  │
│         ▼                                                  │
│  4. Toast: "Paquete transferido de Juan a María"           │
│         │                                                  │
│         ▼                                                  │
│  5. Agregar a lista de FlexScanScreen                      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Flujo Completo: Escanear hasta Entregar

```text
FASE 1: ESCANEO                    FASE 2: OPTIMIZACIÓN
┌────────────────────┐             ┌────────────────────┐
│ Escanear Paquete 1 │             │ Ver Mapa           │
│ Escanear Paquete 2 │  ────────►  │ Toca "Optimizar"   │
│ Escanear Paquete 3 │             │ Lista se reordena  │
│ ...                │             │ según GPS actual   │
└────────────────────┘             └────────────────────┘
                                            │
                                            ▼
FASE 4: ENTREGA                    FASE 3: INICIAR
┌────────────────────┐             ┌────────────────────┐
│ Navegar con GPS    │             │ Toca "Iniciar"     │
│ Confirmar entrega  │  ◄────────  │ Se crea ruta       │
│ Firma + Foto       │             │ planificada        │
│ Siguiente parada   │             │ Navega a           │
└────────────────────┘             │ ActiveRouteNav     │
                                   └────────────────────┘
```

---

## Secuencia de Implementación

### Paso 1: Migración de Base de Datos
- Agregar columna `modo_flex` a `tenants`

### Paso 2: Actualizar useTenant y EditTenantDialog
- Exponer `modo_flex` en el hook
- Agregar control en panel de configuración de empresas

### Paso 3: Crear useFlexPackages hook
- Estado para lista de paquetes acumulados
- Persistencia en sessionStorage
- Función de optimización nearest-neighbor
- Lógica de transferencia automática

### Paso 4: Crear FlexScanScreen
- Interfaz de escaneo con acumulación
- Integración con QRScanner existente
- Lista de paquetes con botón de eliminar

### Paso 5: Crear FlexMapPreview
- Mapa con marcadores numerados
- Botón de optimización
- Reutiliza MapView existente

### Paso 6: Crear TransferFlexPackagesDialog
- Selector de chofer (para operadores/admins)
- Crear ruta planificada asignada

### Paso 7: Integrar en MobileAppLayout
- Detectar `modo_flex` del tenant
- Renderizar FlexScanScreen cuando corresponda
- Simplificar navegación inferior

### Paso 8: Activar para BlackBox
- Super Admin activa `modo_flex` para el tenant de BlackBox

---

## Compatibilidad con Flujos Existentes

| Escenario | Comportamiento |
|-----------|---------------|
| Empresa sin modo_flex | Flujo normal (sin cambios) |
| Empresa con modo_flex + rol chofer | Ve FlexScanScreen |
| Empresa con modo_flex + rol operador | Ve FlexScanScreen + botón "Asignar a Chofer" |
| Paquete ya asignado | Transferencia automática al escanear |
| Paquete ML no registrado | Se muestra MLRegisterDialog (existente) |

---

## Resultado Final para BlackBox

1. **Repartidor abre app** → Ve botón grande "ESCANEAR"
2. **Escanea paquetes** → Se acumulan en lista (transferencia automática si es de otro)
3. **Toca "VER MAPA"** → Ve paradas con marcadores numerados
4. **Toca "OPTIMIZAR"** → Lista se reordena por distancia desde GPS
5. **Toca "INICIAR REPARTO"** → Navega a ActiveRouteNavigation con mapa, GPS, y entrega
6. **Completa entregas** → Firma, foto, siguiente parada

Si un **operador** escanea los paquetes:
1. Escanea paquetes → Se acumulan
2. Toca "ASIGNAR A CHOFER" → Selecciona chofer
3. El chofer ve la ruta en "Mis Rutas" y la inicia cuando esté listo


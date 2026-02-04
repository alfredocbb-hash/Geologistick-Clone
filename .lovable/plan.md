

# Plan: Bandeja de Incidencias con Acciones Manuales

## Resumen

Crear una nueva sección "Incidencias" donde los administradores puedan revisar y gestionar envíos con problemas reportados (ausente, rechazo, dirección incorrecta, etc.), decidiendo la acción apropiada: **re-intentar**, **reprogramar**, o **cancelar/devolver**.

---

## Flujo Propuesto

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     FLUJO DE INCIDENCIAS                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  CHOFER reporta problema (ausente, rechazo, dirección incorrecta)   │
│                              ↓                                       │
│  Estado envío → "devuelto" (actual) o "incidencia" (nuevo)          │
│  + Registro en tabla "incidentes" con estado = 'pendiente'          │
│                              ↓                                       │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │              BANDEJA DE INCIDENCIAS (nueva)                 │     │
│  │  Administrador revisa y decide acción:                      │     │
│  │                                                             │     │
│  │  [Re-intentar hoy]  → estado = pendiente, chofer = null    │     │
│  │                       Aparece en Planificador para nueva   │     │
│  │                       ruta inmediata                        │     │
│  │                                                             │     │
│  │  [Reprogramar]      → estado = pendiente, chofer = null    │     │
│  │                       + nueva fecha_entrega                 │     │
│  │                       + reprogramado_count++                │     │
│  │                       Aparece en "Reprogramados"            │     │
│  │                                                             │     │
│  │  [Devolver/Cancelar] → estado = devuelto o cancelado       │     │
│  │                        Cierra la incidencia                 │     │
│  │                                                             │     │
│  │  [Corregir dirección] → Abre formulario para actualizar    │     │
│  │                         dirección antes de re-asignar       │     │
│  └────────────────────────────────────────────────────────────┘     │
│                              ↓                                       │
│  Incidente marcado como "resuelto" con la acción tomada             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Componentes a Crear

| Componente | Descripción |
|------------|-------------|
| `src/pages/Incidents.tsx` | Página principal de bandeja de incidencias |
| `src/components/incidents/IncidentActionDialog.tsx` | Dialog para resolver incidencia con opciones |
| `src/components/incidents/EditAddressDialog.tsx` | Dialog para corregir dirección antes de re-asignar |

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/layout/AppSidebar.tsx` | Agregar enlace "Incidencias" en el menú |
| `src/App.tsx` | Agregar ruta `/incidents` |
| `src/components/incidents/ReportIncidentDialog.tsx` | Cambiar estado a "incidencia" en lugar de "devuelto" |

## Migraciones de Base de Datos

| Cambio | Descripción |
|--------|-------------|
| Agregar estado "incidencia" | Nuevo valor en el ENUM `estado_envio` para envíos con problema activo |
| Agregar campo `accion_tomada` a incidentes | Para registrar qué se hizo (re_intento, reprogramado, devuelto, cancelado) |
| Agregar campo `resuelto_por` a incidentes | ID del usuario que resolvió la incidencia |
| Agregar campo `resuelto_at` a incidentes | Timestamp de resolución |

---

## Sección Tecnica

### 1. Nueva Pagina de Incidencias

La bandeja mostrara una tabla con:
- Tracking del envio
- Tipo de incidente (ausente, rechazo, direccion incorrecta, paquete daniado, otro)
- Chofer que reporto
- Fecha del reporte
- Cantidad de intentos previos (`reprogramado_count`)
- Estado de la incidencia (pendiente, resuelto)
- Acciones disponibles

### 2. Logica del Dialog de Accion

```typescript
// Opciones de resolucion
const RESOLUTION_ACTIONS = [
  { 
    value: 're_intento', 
    label: 'Re-intentar hoy',
    description: 'Liberar para asignar a otra ruta inmediatamente'
  },
  { 
    value: 'reprogramar', 
    label: 'Reprogramar',
    description: 'Programar nuevo intento para otra fecha'
  },
  { 
    value: 'corregir_direccion', 
    label: 'Corregir direccion',
    description: 'Actualizar direccion antes de re-asignar'
  },
  { 
    value: 'devolver', 
    label: 'Devolver al remitente',
    description: 'Marcar para devolucion'
  },
  { 
    value: 'cancelar', 
    label: 'Cancelar envio',
    description: 'Cancelar el envio definitivamente'
  },
];
```

### 3. Migracion SQL

```sql
-- Agregar estado 'incidencia' al enum
ALTER TYPE estado_envio ADD VALUE IF NOT EXISTS 'incidencia';

-- Agregar campos de resolucion a incidentes
ALTER TABLE incidentes 
ADD COLUMN IF NOT EXISTS accion_tomada text,
ADD COLUMN IF NOT EXISTS resuelto_por uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS resuelto_at timestamptz;

-- Crear indice para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_incidentes_estado_tenant 
ON incidentes(tenant_id, estado);
```

### 4. Query de la Bandeja

```typescript
const { data: incidencias } = useQuery({
  queryKey: ['incidencias-pendientes'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('incidentes')
      .select(`
        *,
        envio:envios(
          id, tracking_number, estado, reprogramado_count,
          nombre_destinatario, direccion_entrega, ciudad_entrega
        ),
        chofer:profiles!incidentes_chofer_id_fkey(nombre, apellido)
      `)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }
});
```

### 5. Logica de Resolucion

```typescript
const resolveIncident = async (incidentId: string, action: string, data?: any) => {
  // Actualizar incidente
  await supabase
    .from('incidentes')
    .update({
      estado: 'resuelto',
      accion_tomada: action,
      resolucion: data?.notas || null,
      resuelto_por: user.id,
      resuelto_at: new Date().toISOString()
    })
    .eq('id', incidentId);

  // Actualizar envio segun accion
  switch (action) {
    case 're_intento':
      await supabase
        .from('envios')
        .update({ estado: 'pendiente', chofer_id: null })
        .eq('id', envioId);
      break;
    
    case 'reprogramar':
      await supabase
        .from('envios')
        .update({ 
          estado: 'pendiente', 
          chofer_id: null,
          fecha_entrega: data.nuevaFecha,
          reprogramado_count: incrementar,
          ultima_reprogramacion: new Date().toISOString()
        })
        .eq('id', envioId);
      break;
    
    case 'devolver':
      await supabase
        .from('envios')
        .update({ estado: 'devuelto' })
        .eq('id', envioId);
      break;
    
    case 'cancelar':
      await supabase
        .from('envios')
        .update({ estado: 'cancelado' })
        .eq('id', envioId);
      break;
  }
};
```

---

## Relacion entre Incidencias y Reprogramados

| Seccion | Proposito |
|---------|-----------|
| **Bandeja de Incidencias** | Envios con problema que requieren decision administrativa |
| **Reprogramados (Planificador)** | Envios ya liberados listos para asignar a nueva ruta |

Cuando el admin elige "Re-intentar" o "Reprogramar" en la bandeja de incidencias, el envio pasa automaticamente a estar disponible en el Planificador (aparecera en "Reprogramados" si tiene `reprogramado_count > 0`).

---

## Integracion con Menu

Se agregara un nuevo item en el sidebar:

```text
Operaciones
├── Escaneo QR
├── Planificador
├── Incidencias ← NUEVO (con badge de pendientes)
├── Hojas de Ruta
└── Mapa en Vivo
```


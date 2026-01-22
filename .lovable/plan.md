

# Plan: Corregir Nombres Duplicados y Logo del Sidebar

## Problema 1: Nombres Duplicados en Envíos Importados

### Diagnóstico
Los envíos importados tienen los nombres correctos guardados en los campos directos de la tabla `envios`:
- `nombre_remitente` = "KINGDOM VINTAGE", "GABRIEL SANABRIA", etc.
- `nombre_destinatario` = "Gabriel Marrero", "Victor Orlando Ordoñez", etc.

Sin embargo, la página de envíos lee los nombres desde la relación con `clientes`, donde TODOS los registros apuntan incorrectamente al mismo cliente "Alejandro Maximiliano Echavarria".

### Solución
Modificar `Shipments.tsx` para priorizar los campos directos del envío sobre la relación con clientes:

| Archivo | Cambio |
|---------|--------|
| `src/pages/Shipments.tsx` | Líneas 305-309: Usar `nombre_remitente`/`nombre_destinatario` primero, fallback a relación cliente |

**Lógica propuesta:**
```tsx
// Remitente
{envio.nombre_remitente || 
  (envio.remitente ? `${envio.remitente.nombre} ${envio.remitente.apellido || ''}` : '-')}

// Destinatario
{envio.nombre_destinatario || 
  (envio.destinatario ? `${envio.destinatario.nombre} ${envio.destinatario.apellido || ''}` : '-')}
```

---

## Problema 2: Logo Sobresale al Cerrar Menú

### Diagnóstico
Cuando hay un logo personalizado (branding), el código siempre muestra la imagen completa sin verificar si el sidebar está colapsado.

### Solución
Modificar `AppSidebar.tsx` para ajustar el logo según el estado del sidebar:

| Archivo | Cambio |
|---------|--------|
| `src/components/layout/AppSidebar.tsx` | Líneas 271-290: Ajustar tamaño del logo cuando `collapsed` |

**Lógica propuesta:**
```tsx
{branding?.logo_light ? (
  <img 
    src={branding.logo_light} 
    alt={branding.nombre_app || 'Logo'} 
    className={cn(
      "object-contain transition-all",
      collapsed 
        ? "h-8 w-8 max-w-[32px]"  // Logo pequeño cuando colapsado
        : "h-10 w-auto max-w-[160px]"  // Logo normal cuando expandido
    )}
  />
) : (
  // ... código existente
)}
```

Adicionalemente, agregar `overflow-hidden` al contenedor del header del sidebar para prevenir desbordamiento.

---

## Resumen de Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Shipments.tsx` | Priorizar campos directos `nombre_remitente` y `nombre_destinatario` |
| `src/components/layout/AppSidebar.tsx` | Ajustar tamaño del logo según estado `collapsed` |

---

## Resultado Esperado

1. **Envíos**: Mostrarán los nombres correctos importados desde el CSV (KINGDOM VINTAGE, Gabriel Marrero, etc.)
2. **Sidebar**: El logo se redimensionará correctamente al cerrar el menú, sin sobresalir del área colapsada


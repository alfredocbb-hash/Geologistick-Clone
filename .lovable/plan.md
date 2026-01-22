

# Plan: Agregar Botones de Compartir Tracking

## Objetivo

Añadir botones para copiar el enlace de tracking y compartir por WhatsApp en el diálogo de detalles del envío (`ShipmentDetailsDialog`), disponible para todas las empresas.

---

## Ubicación del Cambio

Los botones se agregarán junto a los existentes (EPOD y Etiqueta) en el header del diálogo:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  📦 Detalles del Envío                                                  │
│                                                                         │
│  [📋 Copiar Link] [📱 WhatsApp] [📥 EPOD] [🖨️ Etiqueta]                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Funcionalidad

### 1. Botón "Copiar Link"
- **Icono**: `Copy` o `Link` de Lucide
- **Acción**: Copia la URL de tracking al portapapeles
- **Formato URL**: `https://geologic.lovable.app/tracking?q={TRACKING_NUMBER}`
- **Feedback**: Toast de confirmación "Enlace copiado al portapapeles"

### 2. Botón "WhatsApp"
- **Icono**: Icono de compartir o mensaje
- **Acción**: Abre WhatsApp con mensaje predefinido
- **Mensaje**:
  ```
  🚚 Rastrea tu envío:
  
  Número de seguimiento: {TRACKING_NUMBER}
  
  Sigue el estado aquí: {URL}
  ```

---

## Archivo a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/shipments/ShipmentDetailsDialog.tsx` | Agregar botones de compartir |

---

## Cambios Técnicos

### Importar iconos adicionales

```typescript
import { 
  // ... existentes ...
  Copy,
  Share2,
} from 'lucide-react';
```

### Agregar funciones de compartir

```typescript
const getTrackingUrl = () => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/tracking?q=${envio?.tracking_number}`;
};

const handleCopyLink = async () => {
  try {
    await navigator.clipboard.writeText(getTrackingUrl());
    toast.success('Enlace copiado al portapapeles');
  } catch (error) {
    toast.error('Error al copiar el enlace');
  }
};

const handleShareWhatsApp = () => {
  const url = getTrackingUrl();
  const message = encodeURIComponent(
    `🚚 Rastrea tu envío:\n\n` +
    `Número de seguimiento: ${envio?.tracking_number}\n\n` +
    `Sigue el estado aquí: ${url}`
  );
  window.open(`https://wa.me/?text=${message}`, '_blank');
};
```

### Agregar botones en el header (junto a EPOD y Etiqueta)

```tsx
<Button 
  variant="outline" 
  size="sm" 
  onClick={handleCopyLink}
  title="Copiar enlace de tracking"
>
  <Copy className="h-4 w-4" />
</Button>
<Button 
  variant="outline" 
  size="sm" 
  onClick={handleShareWhatsApp}
  title="Compartir por WhatsApp"
>
  <Share2 className="h-4 w-4" />
</Button>
```

---

## Resultado Visual

```text
Antes:                          Después:
┌────────────────────────┐     ┌────────────────────────────────────┐
│  [📥 EPOD] [🖨️ Etiq]   │     │  [📋] [📤] [📥 EPOD] [🖨️ Etiqueta] │
└────────────────────────┘     └────────────────────────────────────┘
                                 │     │
                                 │     └── Compartir WhatsApp
                                 └──────── Copiar Link
```

---

## Beneficios

1. **Fácil acceso**: Botones visibles directamente en el diálogo
2. **Multi-empresa**: Funciona para todos los tenants usando `window.location.origin`
3. **Feedback inmediato**: Toast confirma la acción
4. **Compatible móvil**: WhatsApp se abre en la app nativa si está disponible



# Plan: Mejorar PDFs Descargables con Diseño Profesional e Imágenes

## Objetivo
Transformar los PDFs de las guías de usuario descargables desde "Configuración del Sistema" en documentos profesionales que incluyan:
- Logo oficial de Geologistick
- Diseño visual mejorado con íconos y gráficos
- Portada más atractiva
- Encabezados/pies de página consistentes
- Mejor tipografía y espaciado

---

## Estado Actual

Los archivos de generación de PDFs (`generateUserGuidePDF.ts` y `generateEcommerceGuidePDF.ts`) actualmente:

| Característica | Estado |
|----------------|--------|
| Logo | No incluido |
| Portada | Solo texto con fondo azul |
| Encabezados | Texto simple |
| Pies de página | Solo número de página |
| Imágenes/Íconos | Ninguno |

---

## Mejoras Propuestas

### 1. Agregar Logo en Portada y Encabezados

El logo se cargará como base64 y se incluirá en:
- Portada central (tamaño grande)
- Encabezado de cada página (tamaño pequeño)

### 2. Portada Profesional Mejorada

```text
┌─────────────────────────────────────┐
│           [Fondo Azul]              │
│                                     │
│         ┌─────────────┐             │
│         │   [LOGO]    │             │
│         └─────────────┘             │
│                                     │
│         GEOLOGISTICK                │
│   Sistema de Gestión Logística      │
│                                     │
└─────────────────────────────────────┘
│                                     │
│                                     │
│       GUÍA DE USUARIO               │
│    ─────────────────────            │
│    Manual Completo del Sistema      │
│                                     │
│                                     │
│    Generado: 27 de enero, 2026      │
│    Versión: 1.0                     │
│                                     │
└─────────────────────────────────────┘
```

### 3. Encabezados de Página Consistentes

Cada página incluirá:
- Logo pequeño (izquierda)
- Nombre del documento (centro)
- Número de página (derecha)

### 4. Mejoras Visuales Adicionales

| Elemento | Mejora |
|----------|--------|
| Títulos de sección | Barra de color con ícono representativo |
| Listas | Bullets con diseño consistente |
| Tablas | Bordes y alternancia de colores en filas |
| Índice | Links navegables (si es soportado) |

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/lib/generateUserGuidePDF.ts` | Agregar logo, mejorar portada y encabezados |
| `src/lib/generateEcommerceGuidePDF.ts` | Mismo tratamiento visual |
| `src/pages/SystemSettings.tsx` | Pasar logo a las funciones de generación |

---

## Sección Técnica

### Cargar Logo como Base64

Se creará una función helper para convertir el logo importado a base64:

```typescript
import geologistickLogo from '@/assets/geologistick-logo.png';

// Función para convertir imagen a base64
async function loadLogoAsBase64(): Promise<string | null> {
  try {
    const response = await fetch(geologistickLogo);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
```

### Modificar Portada con Logo

```typescript
export const generateUserGuidePDF = async (): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Cargar logo
  const logoBase64 = await loadLogoAsBase64();
  
  // Portada con fondo
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 80, 'F');
  
  // Logo centrado en portada
  if (logoBase64) {
    const logoSize = 40;
    doc.addImage(
      logoBase64, 
      'PNG', 
      (pageWidth - logoSize) / 2, 
      15, 
      logoSize, 
      logoSize
    );
  }
  
  // Título debajo del logo
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Geologistick', pageWidth / 2, 65, { align: 'center' });
  
  // ... resto del contenido
};
```

### Encabezado con Logo en Cada Página

```typescript
const addHeader = (logoBase64: string | null) => {
  // Logo pequeño
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, 5, 12, 12);
  }
  
  // Línea separadora
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.5);
  doc.line(margin, 18, pageWidth - margin, 18);
  
  // Título del documento
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text('Guía de Usuario - Geologistick', pageWidth / 2, 14, { align: 'center' });
};
```

### Cambio de Firma de Funciones

Las funciones pasarán a ser asíncronas para cargar el logo:

```typescript
// Antes
export const generateUserGuidePDF = (): void => { ... }

// Después
export const generateUserGuidePDF = async (): Promise<void> => { ... }
```

### Actualizar SystemSettings.tsx

```typescript
const handleDownloadGuide = async () => {
  setIsGeneratingPDF(true);
  try {
    await generateUserGuidePDF(); // Ya es async
    toast({
      title: "PDF generado",
      description: "La guía se ha descargado correctamente.",
    });
  } catch (error) {
    // ... error handling
  } finally {
    setIsGeneratingPDF(false);
  }
};
```

### Diseño Visual de Secciones

Cada sección tendrá un encabezado mejorado:

```typescript
// Encabezado de sección con diseño
doc.setFillColor(59, 130, 246);
doc.roundedRect(margin, yPosition, contentWidth, 12, 2, 2, 'F');

doc.setTextColor(255, 255, 255);
doc.setFontSize(12);
doc.setFont('helvetica', 'bold');
doc.text(section.title, margin + 5, yPosition + 8);
```

---

## Resultado Esperado

Después de implementar estos cambios, los PDFs descargados tendrán:

1. **Portada profesional** con logo centrado y diseño corporativo
2. **Encabezados consistentes** en todas las páginas con mini-logo
3. **Pies de página** con numeración y fecha de generación
4. **Secciones visuales** con barras de color y mejor espaciado
5. **Aspecto corporativo** que refuerza la marca Geologistick

Los usuarios verán un documento de calidad profesional que pueden compartir con clientes o usar como material de capacitación.

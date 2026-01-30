
# Plan: Guía de Usuario del Módulo de Tarifas (PDF)

## Resumen

Crear un PDF profesional descargable que explique cómo funciona y cómo configurar correctamente el módulo de Tarifas. Seguirá el mismo patrón de las guías existentes (User Guide y e-Commerce Guide), con branding consistente y color temático naranja/ámbar para diferenciar el módulo de Tarifas.

---

## Contenido de la Guía

La guía cubrirá los siguientes temas:

### 1. Introducción al Módulo de Tarifas
- Qué es una tarifa y para qué sirve
- Estructura: Precio base + Conceptos adicionales
- Tipos de tarifas disponibles

### 2. Tipos de Tarifas
- **Por Peso (Kg)**: Método simple vs rangos escalonados
- **Por Distancia (Km)**: Precio base + kilómetros
- **Por Volumen (m³)**: Para paquetes de gran tamaño
- **Por Zona**: Precio fijo según zona origen/destino
- **Por Código Postal**: Precio según CP

### 3. Crear una Nueva Tarifa
- Pasos para crear tarifa
- Configurar precio base (Flete)
- Configurar rangos de peso escalonados
- Umbral de volumen (cuándo cobra por m³)
- Ejemplo práctico

### 4. Conceptos Adicionales
- Diferencia entre conceptos Básicos y Adicionales
- Conceptos típicos: Retiro, Entrega, Seguro, Embalaje
- Configurar precios fijos vs porcentajes
- Cómo habilitar conceptos por sucursal

### 5. Asignar Tarifas a Sucursales
- Por qué asignar tarifas a sucursales
- Cómo hacerlo desde el diálogo de sucursales
- Tarifa por defecto cuando solo hay una

### 6. Cálculo del Flete en Envíos
- Fórmula completa del cálculo
- Ejemplo paso a paso
- Cuándo aplica retiro/entrega según tipo de servicio

### 7. Configuración de Seguro
- Fórmula: Base + ((Valor - Mínimo) × Porcentaje)
- Valor mínimo por defecto
- Tope máximo de cobertura

### 8. Ajustes Masivos de Precios
- Aumentos porcentuales globales
- Qué afecta: precios base, rangos, conceptos
- Historial de ajustes

### 9. Tarifas para e-Commerce
- Asignar tarifa a sellers
- Cotización automática en Tiendanube
- Tarifa express (opcional)

### 10. Preguntas Frecuentes
- ¿Por qué no aparece mi tarifa al crear envío?
- ¿Cómo cambio el precio del seguro?
- ¿Puedo tener diferentes precios por sucursal?

---

## Implementación Técnica

### Archivos a Crear

| Archivo | Descripción |
|---------|-------------|
| `src/lib/generateRatesGuidePDF.ts` | Función para generar el PDF de tarifas |

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/SystemSettings.tsx` | Agregar card y botón para descargar la guía de Tarifas |

### Estructura del Código

```typescript
// src/lib/generateRatesGuidePDF.ts

const RATES_GUIDE_CONTENT = {
  title: 'Guía de Tarifas',
  subtitle: 'Configuración de Precios - Geologistick',
  sections: [
    { title: '1. INTRODUCCION', content: '...' },
    { title: '2. TIPOS DE TARIFAS', content: '...' },
    // ... más secciones
  ]
};

const PRIMARY_COLOR: [number, number, number] = [245, 158, 11]; // Amber/Orange

export const generateRatesGuidePDF = async (): Promise<void> => {
  // Usar las mismas utilidades de pdfHelpers.ts
  // Generar portada, contenido con paginación, footer
};
```

### UI en SystemSettings

Se agregará una tercera card con:
- Icono: DollarSign (del módulo Tarifas)
- Color temático: Amber/Naranja
- Lista de temas cubiertos
- Botón "Descargar Guía de Tarifas"

---

## Vista Previa del PDF

**Portada:**
- Header naranja con logo Geologistick
- Título: "GUÍA DE TARIFAS"
- Subtítulo: "Manual de Configuración de Precios"
- Fecha de generación

**Páginas de Contenido:**
- Header con logo pequeño y línea naranja
- Secciones con títulos en negrita
- Bullets para instrucciones paso a paso
- Ejemplos de cálculo con números
- Footer con fecha y número de página

---

## Resultado Esperado

| Ubicación | Elemento |
|-----------|----------|
| Configuración del Sistema | Nueva card "Guía de Tarifas" |
| PDF | ~15-20 páginas con toda la documentación |
| Estilo | Consistente con guías existentes, color naranja |

El administrador podrá descargar el PDF y compartirlo con el equipo para capacitación.


# Plan: Corregir EPOD con Caracteres Corruptos

## Problema Identificado

El PDF del EPOD muestra caracteres ilegibles como se ve en la imagen:

- `Ø=ÜÍ Ubicación GØR.S` → Debería decir "Ubicación GPS"
- `Ituzaingÿÿ` → Debería decir "Ituzaingó"

### Causas

1. **Emojis no soportados**: jsPDF con fuente `helvetica` NO renderiza emojis Unicode como `📍`
2. **Encoding incorrecto**: Caracteres latinos extendidos (ó, í, á) se corrompen

---

## Solución

### Cambios en `src/lib/generateEPODPDF.ts`

| Línea | Problema | Solución |
|-------|----------|----------|
| 215 | `'📍 Ubicación GPS:'` | Cambiar a `'[GPS] Ubicación:'` |
| 448 | `📍 ${item.ubicacion}` | Cambiar a `'Ubicacion: ${item.ubicacion}'` |
| Varias | Tildes en texto (Tránsito, etc.) | Normalizar caracteres o reemplazar |

---

## Cambios Específicos

### 1. Reemplazar emojis por texto

```typescript
// Línea 215 - Antes:
doc.text('📍 Ubicación GPS:', margin + 4, yPosition + 6);

// Después:
doc.text('[GPS] Ubicacion:', margin + 4, yPosition + 6);
```

```typescript
// Línea 448 - Antes:
doc.text(`   📍 ${item.ubicacion}`, margin + 10, yPosition + 5);

// Después:
doc.text(`   Ubicacion: ${item.ubicacion}`, margin + 10, yPosition + 5);
```

### 2. Función para sanitizar caracteres especiales

Crear una función helper para normalizar texto antes de enviarlo a jsPDF:

```typescript
const sanitizeText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/á/g, 'a').replace(/Á/g, 'A')
    .replace(/é/g, 'e').replace(/É/g, 'E')
    .replace(/í/g, 'i').replace(/Í/g, 'I')
    .replace(/ó/g, 'o').replace(/Ó/g, 'O')
    .replace(/ú/g, 'u').replace(/Ú/g, 'U')
    .replace(/ñ/g, 'n').replace(/Ñ/g, 'N')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U');
};
```

### 3. Actualizar labels sin tildes

```typescript
const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  recogido: 'Recogido',
  en_bodega: 'En Bodega',
  en_transito: 'En Transito',    // Sin tilde
  en_reparto: 'En Reparto',
  entregado: 'Entregado',
  devuelto: 'Devuelto',
  cancelado: 'Cancelado',
};
```

---

## Archivo a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/lib/generateEPODPDF.ts` | Remover emojis, agregar función sanitize, actualizar labels |

---

## Resultado Esperado

| Antes | Después |
|-------|---------|
| `Ø=ÜÍ Ubicación GØR.S` | `[GPS] Ubicacion:` |
| `Ituzaingÿÿ` | `Ituzaingo` |
| `En Tránsito` con caracteres rotos | `En Transito` legible |

---

## Secciones Técnicas

El problema fundamental es que jsPDF usa el subset de fuentes estándar de PDF (Helvetica) que solo soportan el encoding WinAnsiEncoding (Latin-1), que no incluye:
- Emojis Unicode
- Algunos caracteres latinos extendidos dependiendo del sistema

La solución más robusta y liviana es sanitizar el texto antes de renderizarlo, eliminando emojis y normalizando caracteres con tildes a sus equivalentes ASCII.

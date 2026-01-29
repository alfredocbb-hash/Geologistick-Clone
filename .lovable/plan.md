
# Plan: Comprobante Doble en Una Sola Hoja A4

## Objetivo

Modificar el generador de PDF para que ambas copias (Cliente y Agencia) aparezcan en una **sola hoja A4**, dividida en dos mitades iguales:

```text
┌─────────────────────────────────────────────────────┐
│                                                     │
│              COPIA AGENCIA                          │
│         (Mitad superior de la hoja)                 │
│                                                     │
├─────────────────────────────────────────────────────┤  ← Línea de corte
│                                                     │
│              COPIA CLIENTE                          │
│         (Mitad inferior de la hoja)                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Cambios en la Estructura

### Dimensiones
- Hoja A4: 210mm x 297mm
- Cada comprobante: 210mm x **~140mm** (mitad de la hoja, dejando espacio para línea de corte)
- Márgenes reducidos: 8mm laterales, 6mm arriba/abajo

### Diseño Compacto (Cada Mitad)

Cada comprobante tendrá todos los elementos pero más compactos:
1. **Header**: Logo pequeño (15mm), nombre empresa, guía y fecha
2. **Origen/Destino**: En una sola línea horizontal
3. **Remitente/Destinatario**: Cajas lado a lado, altura reducida
4. **Descripción/Conceptos**: En dos columnas compactas
5. **QR + Total**: QR más pequeño (25mm) a la izquierda, total a la derecha
6. **Firmas**: En una sola línea horizontal
7. **Badge**: "COPIA AGENCIA" o "COPIA CLIENTE"

### Línea de Corte

Entre ambas copias se dibujará:
- Línea punteada horizontal
- Ícono de tijera pequeño (opcional: texto "✂ CORTAR AQUÍ")

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/lib/generateShipmentReceiptPDF.ts` | Refactorizar para dibujar 2 comprobantes en una página |
| `src/pages/PrintReceipt.tsx` | Un solo botón "Descargar Comprobante" (genera ambas copias) |

---

## Detalles Técnicos

### Nueva Estructura de `generateShipmentReceiptPDF.ts`

```typescript
// Nueva función que genera ambas copias en una hoja
export async function generateShipmentReceiptPDF(
  shipment: ShipmentData,
  detalles: DetalleConcepto[],
  branding: BrandingData | null,
  trackingUrl: string
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  const pageHeight = 297; // A4 height
  const halfHeight = pageHeight / 2; // ~148.5mm por comprobante
  
  // Dibujar comprobante superior (COPIA AGENCIA)
  drawReceipt(doc, shipment, detalles, branding, trackingUrl, 0, 'agencia');
  
  // Línea de corte
  drawCutLine(doc, halfHeight);
  
  // Dibujar comprobante inferior (COPIA CLIENTE)
  drawReceipt(doc, shipment, detalles, branding, trackingUrl, halfHeight, 'cliente');
  
  doc.save(`Comprobante_${shipment.tracking_number}.pdf`);
}
```

### Función Interna `drawReceipt`

Dibuja un comprobante compacto en el offset vertical especificado:

```typescript
function drawReceipt(
  doc: jsPDF,
  shipment: ShipmentData,
  detalles: DetalleConcepto[],
  branding: BrandingData | null,
  trackingUrl: string,
  yOffset: number,  // 0 para arriba, halfHeight para abajo
  copyType: 'agencia' | 'cliente'
) {
  // Todo el contenido se dibuja con y + yOffset
  // Escala y espacios reducidos para caber en media hoja
}
```

### Escalado de Elementos

| Elemento | Tamaño Original | Tamaño Compacto |
|----------|----------------|-----------------|
| Logo | 25mm | 15mm |
| Fuentes títulos | 14pt | 10pt |
| Fuentes texto | 9pt | 7pt |
| Caja remitente | 35mm alto | 22mm alto |
| Caja producto | 40mm alto | 24mm alto |
| QR Code | 35mm | 22mm |
| Firmas | 35mm alto | 18mm alto |
| Observaciones | 25mm alto | 12mm alto |

---

## Cambios en PrintReceipt.tsx

Simplificar los botones:

**Antes:**
```tsx
<Button onClick={() => handleGeneratePDF('agencia')}>Copia Agencia</Button>
<Button onClick={() => handleGeneratePDF('cliente')}>Copia Cliente</Button>
```

**Después:**
```tsx
<Button onClick={() => handleGeneratePDF()}>
  <Printer className="h-4 w-4 mr-2" />
  Descargar Comprobante
</Button>
```

Un solo botón genera el PDF con ambas copias.

---

## Resultado Final

Al hacer clic en "Descargar Comprobante", se genera un único PDF A4 con:
- **Mitad superior**: Copia Agencia (se queda en la sucursal)
- **Línea de corte**: Con indicador visual para separar
- **Mitad inferior**: Copia Cliente (se entrega al cliente)

Esto permite imprimir una sola hoja y cortar para entregar al cliente su copia.

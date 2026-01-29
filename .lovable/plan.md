
# Plan: Alternativa de Pagos para Argentina + Generador de Comprobante de Envío

---

## 1. Alternativa a Stripe para Argentina

**Buenas noticias:** Ya tienen **Mercado Pago** completamente integrado en el sistema. Esta es la mejor alternativa para Argentina porque:

| Característica | Mercado Pago |
|----------------|--------------|
| País | Argentina (nativo) |
| Requisitos | Solo DNI/CUIT y cuenta bancaria argentina |
| Moneda | Pesos Argentinos (ARS) |
| Comisión | 3.99% + IVA por transacción |
| QR/Link de pago | Sí |
| Webhooks | Configurados en el sistema |

**Ubicación en el sistema:**
- Configuración en: **Configuración > Integraciones > Mercado Pago**
- Edge functions: `mercadopago-payment` y `mercadopago-webhook`

Solo necesitan configurar sus credenciales de Mercado Pago (Access Token y Public Key) desde el [portal de desarrolladores de Mercado Pago](https://www.mercadopago.com.ar/developers/panel).

---

## 2. Generador de Comprobante de Envío (Guía de Despacho)

Basándome en la imagen de referencia, crearé un nuevo comprobante que incluya:

### Estructura del Comprobante

```text
┌─────────────────────────────────────────────────────┐
│  [LOGO EMPRESA]            Guía Nº: XXX-ENV-XXXX   │
│  Dirección de sucursal     Fecha: 29/01/2026       │
│  Teléfono                  DOCUMENTO NO VÁLIDO...   │
├─────────────────────────────────────────────────────┤
│  ORIGEN: [Ciudad]          DESTINO: [Ciudad]       │
├─────────────────────────────────────────────────────┤
│  Remitente: [Nombre]       Destinatario: [Nombre]  │
│  Domicilio: [Dirección]    Domicilio: [Dirección]  │
│  Teléfono: [Número]        Teléfono: [Número]      │
├─────────────────────────────────────────────────────┤
│  Cond. Venta: [Tipo Pago]  DNI: [xxx]              │
├───────────────────────┬─────────────────────────────┤
│  DESCRIPCIÓN PRODUCTO │          CONCEPTOS         │
├───────────────────────┼─────────────────────────────┤
│  Bultos: X            │  Flete:         $x.xxx,xx  │
│  Descripción          │  Seguro:        $x.xxx,xx  │
│  Peso: X kg           │  Adicionales:   $x.xxx,xx  │
│  Valor Declarado: $   │                            │
├───────────────────────┴─────────────────────────────┤
│  [QR CODE]                       TOTAL: $XX.XXX,XX │
│  Escanear para tracking                            │
├─────────────────────────────────────────────────────┤
│  REMITENTE          │  DESTINATARIO                │
│  ─────────────      │  ─────────────               │
│  FIRMA              │  FIRMA Y ACLARACIÓN          │
│                     │                              │
│  ─────────────      │  ─────────────  ──────────   │
│  ACLARACIÓN         │  DOCUMENTO      FECHA        │
├─────────────────────────────────────────────────────┤
│  Observaciones:                                     │
│  Declaro que esta encomienda no contiene dinero    │
│  ni valores negociables.                           │
├─────────────────────────────────────────────────────┤
│                                    COPIA AGENCIA   │
└─────────────────────────────────────────────────────┘
```

### Características del Comprobante

1. **Código QR integrado**: Enlaza directamente a `/tracking?q=[tracking_number]`
2. **Datos del envío completos**: Origen, destino, remitente, destinatario
3. **Desglose de costos**: Flete, seguro, adicionales, total
4. **Espacios para firmas**: Remitente y destinatario
5. **Declaración legal**: "No contiene dinero ni valores negociables"
6. **Marca "COPIA AGENCIA" / "COPIA CLIENTE"**: Para distinguir copias
7. **Branding del tenant**: Logo y colores de la empresa emisora

### Archivos a Crear/Modificar

| Archivo | Descripción |
|---------|-------------|
| `src/lib/generateShipmentReceiptPDF.ts` | **NUEVO** - Generador del PDF del comprobante |
| `src/pages/PrintReceipt.tsx` | **NUEVO** - Página para vista previa e impresión |
| `src/components/shipments/ShipmentDetailsDialog.tsx` | Agregar botón "Comprobante" |
| `src/App.tsx` | Agregar ruta `/print-receipt` |

### Flujo de Uso

1. Usuario crea envío o abre detalles de un envío existente
2. Hace clic en botón **"Comprobante"** 
3. Se abre `/print-receipt?id=XXX`
4. Ve la vista previa del comprobante con QR
5. Puede elegir: "Copia Agencia" o "Copia Cliente"
6. Imprime o descarga PDF

### Detalle Técnico del QR

El código QR contendrá la URL completa de tracking:
```
https://[dominio]/tracking?q=[tracking_number]
```

Esto permite al cliente escanear con cualquier app de QR y acceder directamente al seguimiento de su envío.

---

## Resumen de Implementación

| Tarea | Tipo | Prioridad |
|-------|------|-----------|
| Mercado Pago | ✅ Ya implementado | Solo configurar credenciales |
| Crear `generateShipmentReceiptPDF.ts` | Nuevo archivo | Alta |
| Crear `PrintReceipt.tsx` | Nueva página | Alta |
| Agregar ruta `/print-receipt` | Modificación | Alta |
| Agregar botón "Comprobante" en ShipmentDetailsDialog | Modificación | Alta |

El comprobante generado será profesional, incluirá el branding de cada empresa y permitirá al cliente rastrear su envío escaneando el QR.



# Plan: Adaptar Etiquetas para Impresoras Láser B&N

## Objetivo

Modificar el estilo de las etiquetas existentes para que se impriman correctamente en impresoras láser blanco y negro, siguiendo el estilo visual de Correo Argentino.

---

## Análisis del Diseño de Referencia (Correo Argentino)

```text
┌─────────────────────────────────────────────────────────────┐
│  ┌────────────┐  PAGADO 0000734304              ┌───────┐  │
│  │            │  VENDEDOR 0000734304            │       │  │
│  │   QR CODE  │  CLIENTE 00734304               │   C   │  │
│  │            │  NOA-UAQI-JBA                   │  DOM  │  │
│  └────────────┘                                 └───────┘  │
│                                                             │
│  REMITENTE                                                 │
│  Barraza Cecilia                                           │
│  C.130 1477                                                │
│  CP: 1884                                                  │
│  11 DE SEPTIEMBRE                                          │
│  BUENOS AIRES                                              │
├─────────────────────────────────────────────────────────────┤
│  ║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║║  │
│  TN 00007343049AL5353C41501                                │
├─────────────────────────────────────────────────────────────┤
│  DESTINATARIO                                              │
│  YANINA DIAZ                                               │
│  calle luna (barrio margarita ferra de bartol.casa 4       │
│  manzana                                                   │
│  CP: 5409                                                  │
│  ULLUM                                                     │
│  SAN JUAN                                                  │
├─────────────────────────────────────────────────────────────┤
│  ║║║║║║║║║║║║║║║║║                        1.100kg.         │
│  T&T HC351728082AR                        10x30x30cm       │
└─────────────────────────────────────────────────────────────┘
```

---

## Cambios de Diseño para B&N

| Elemento | Actual | Nuevo (B&N) |
|----------|--------|-------------|
| Colores de servicio | Azul, verde, naranja, violeta | Negro sólido |
| Emojis | 🏢, 🏠, 📦, 📞 | Texto simple o iconos ASCII |
| Badge de bulto | Fondo gris oscuro | Fondo negro sólido |
| Separadores | Líneas finas | Líneas gruesas (2px) |
| Bordes | Sutiles | Gruesos y definidos |
| QR Code | Con borde gris | Borde negro |

---

## Estructura Visual Nueva

```text
┌══════════════════════════════════════════════════════════════┐
║  SUCURSAL ORIGEN                           22/01/2026        ║
║  CBA01 - Central Córdoba                                     ║
║  Tel: 351-1234567                                            ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ┌──────────────┐      SUC01-ENV-20260122-001                ║
║  │              │                                            ║
║  │   QR CODE    │      ██████████████████████████████████    ║
║  │              │      BULTO 1 / 3                           ║
║  └──────────────┘      SUC01-ENV-20260122-001-01             ║
║                                                              ║
║  ┌──────────────────────────────────────────────────────┐    ║
║  │                ENTREGA A DOMICILIO                   │    ║
║  └──────────────────────────────────────────────────────┘    ║
╠══════════════════════════════════════════════════════════════╣
║  DESTINATARIO                                                ║
║  MARÍA GARCÍA PÉREZ                                          ║
║  DNI: 12.345.678                                             ║
║  Tel: 11-8765-4321                                           ║
╠══════════════════════════════════════════════════════════════╣
║  ENTREGAR EN                                                 ║
║  Av. Corrientes 1234, Piso 5 Depto A                        ║
║  CIUDAD DE BUENOS AIRES                CP: C1000AAA          ║
╠══════════════════════════════════════════════════════════════╣
║  3 bultos  •  15.5 kg          PAGO DESTINO  $12,500         ║
╠══════════════════════════════════════════════════════════════╣
║  OBS: Frágil - Manejar con cuidado                          ║
╠══════════════════════════════════════════════════════════════╣
║  REMITENTE: Juan Pérez • Tel: 11-1234-5678                  ║
╚══════════════════════════════════════════════════════════════╝
```

---

## Cambios Técnicos en `src/pages/PrintLabel.tsx`

### 1. Modificar configuración de tipos de servicio

```typescript
const TIPO_SERVICIO_CONFIG = {
  sucursal_sucursal: { 
    label: 'SUCURSAL A SUCURSAL', 
    icon: '',  // Sin emoji
    bgColor: '#000000',  // Negro sólido
    textColor: '#ffffff',
  },
  sucursal_puerta: { 
    label: 'ENTREGA A DOMICILIO', 
    icon: '',
    bgColor: '#000000',
    textColor: '#ffffff',
  },
  puerta_sucursal: { 
    label: 'RETIRO + ENTREGA SUCURSAL', 
    icon: '',
    bgColor: '#000000',
    textColor: '#ffffff',
  },
  puerta_puerta: { 
    label: 'PUERTA A PUERTA', 
    icon: '',
    bgColor: '#000000',
    textColor: '#ffffff',
  },
};
```

### 2. Actualizar estilos CSS en `generateLabelHTML`

**Bordes más gruesos:**
```css
.label {
  border: 3px solid #000000;  /* Más grueso y negro puro */
}

.header {
  border-bottom: 2px solid #000000;
}

.divider {
  height: 2px;
  background-color: #000000;
}
```

**Badge de bulto en negro:**
```css
.bulto-badge {
  background-color: #000000;
  color: #ffffff;
  border: none;
}
```

**QR con borde negro:**
```css
.qr-container {
  border: 2px solid #000000;
}
```

**Textos sin emojis:**
```css
.icon {
  display: none;  /* Ocultar emojis */
}
```

### 3. Reemplazar emojis por texto

En el HTML generado:
- `🏢` → `[S]` o simplemente eliminarlo
- `🏠` → `[D]` o eliminarlo
- `📦` → eliminar
- `📞` → `Tel:`

### 4. Estilo de servicio tipo Correo Argentino

```html
<div class="service-badge">
  <span class="service-label">${tipoConfig.label}</span>
</div>
```

```css
.service-badge {
  background-color: #000000;
  color: #ffffff;
  padding: 3mm;
  border-radius: 0;  /* Sin bordes redondeados */
  text-align: center;
  font-weight: bold;
  letter-spacing: 1px;
}
```

---

## Paleta de Colores B&N

| Elemento | Color |
|----------|-------|
| Fondo principal | `#ffffff` (blanco) |
| Bordes y líneas | `#000000` (negro) |
| Texto principal | `#000000` (negro) |
| Texto secundario | `#333333` (gris oscuro) |
| Badges/Destacados | `#000000` fondo, `#ffffff` texto |

---

## Consideraciones para Impresión Láser

1. **Sin degradados**: Solo colores sólidos negro/blanco
2. **Contraste máximo**: Negro sobre blanco y viceversa
3. **Bordes definidos**: Líneas gruesas para buena definición
4. **Sin grises medios**: Pueden verse mal en impresoras de baja resolución
5. **Fuentes legibles**: Usar fuentes sans-serif claras
6. **QR robusto**: Nivel de corrección de errores alto (M o H)

---

## Archivo a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/PrintLabel.tsx` | Actualizar estilos CSS y configuración de colores para B&N |

---

## Vista Previa Antes/Después

```text
ANTES (Color):                    DESPUÉS (B&N):
┌─────────────────────┐          ┌═════════════════════┐
│ 🏢 Suc. Central     │          ║ SUCURSAL CENTRAL    ║
│ ┌─────┐             │          ║ ┌─────┐             ║
│ │ QR  │             │          ║ │ QR  │             ║
│ └─────┘             │          ║ └─────┘             ║
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │          ║ ████████████████████║
│ 📦 BULTO 1/3        │          ║ BULTO 1 / 3         ║
│ ┌───────────────┐   │          ╠═════════════════════╣
│ │ PUERTA A PUER │◀─ violeta   ║ │ PUERTA A PUERTA │◀─ negro
│ └───────────────┘   │          ║ └───────────────────┘║
│ 📍 Destinatario     │          ╠═════════════════════╣
│ María García        │          ║ DESTINATARIO        ║
│ 📞 11-8765-4321     │          ║ MARÍA GARCÍA        ║
└─────────────────────┘          ║ Tel: 11-8765-4321   ║
                                 ╚═════════════════════╝
```


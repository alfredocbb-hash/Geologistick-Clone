

## Plan: Cambiar moneda a dólares en el PDF de Acuerdo Comercial

### Cambio único

**Archivo: `src/lib/generateAcuerdoComercialPDF.ts`** (línea ~77)

Cambiar el formato del precio de:
```
$ ${priceMonthly.toLocaleString('es-AR')}
```
a:
```
US$ ${priceMonthly.toLocaleString('es-AR')}
```

### Resumen
- El PDF descargado desde "Gestión de Suscripciones" ya incluye el nombre del tenant (empresa). No necesitás hacer nada extra para eso.
- El PDF descargado desde "Planes de Suscripción" (admin de planes) genera una plantilla genérica sin nombre de empresa.
- Solo se actualiza el símbolo de moneda a `US$` en ambos casos.


# Plan: Unificar Lógica de Cálculo de Tarifas

## ✅ IMPLEMENTADO

La lógica de cálculo de tarifas ha sido unificada en `src/pages/NewShipment.tsx`.

### Cambios realizados:

1. **Nuevo memo `fleteCalculado`**: Retorna el monto del flete + descripción + método aplicado
2. **Resumen de precio corregido**: Muestra el flete real calculado con su descripción
3. **Eliminada duplicación**: Ya no hay líneas separadas para "kg extra"

### Lógica final implementada:

```
TOTAL = FLETE + SEGURO + [RETIRO] + [ENTREGA] + [ADICIONALES]

Donde FLETE se calcula así:
├── Si dimensiones > umbral_volumen_cm → Cobro por m³
├── Si hay rangos_kg escalonados → Precio del rango aplicable
├── Si hay peso_base_hasta + adicional_por_kg → Base + extra
└── Sino → Precio base de la tarifa
```

### Servicios condicionales:
| Modalidad | Flete | + Seguro | + Retiro | + Entrega |
|-----------|-------|----------|----------|-----------|
| Sucursal → Sucursal | ✅ | ✅ | ❌ | ❌ |
| Sucursal → Puerta | ✅ | ✅ | ❌ | ✅ |
| Puerta → Sucursal | ✅ | ✅ | ✅ | ❌ |
| Puerta → Puerta | ✅ | ✅ | ✅ | ✅ |

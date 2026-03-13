

# Porcentaje de flete por bulto extra (cuando no se multiplica)

## Resumen

Agregar un campo de porcentaje que se muestra cuando "Multiplicar flete por bultos" está deshabilitado. Por cada bulto adicional se cobra ese % del flete. Ejemplo: flete $14.000, 2 bultos, 50% → $14.000 + $7.000 = $21.000.

## Cambios

### 1. Migración SQL — nueva columna `porcentaje_flete_bulto`
```sql
ALTER TABLE tarifas ADD COLUMN porcentaje_flete_bulto numeric DEFAULT 0;
```

### 2. `CreateTarifaWizard.tsx`
- Agregar `porcentaje_flete_bulto: string` al `FormData`
- Debajo del switch "Multiplicar flete por bultos", cuando está **OFF**, mostrar un input de porcentaje:
  ```
  [Switch OFF] → Input: "Porcentaje por bulto extra (%)" [____]
  ```

### 3. `TarifaSandbox.tsx`
- Agregar `porcentaje_flete_bulto: string` a props
- En STEP 3, si `multiplicar_flete_por_bultos` es false y `porcentaje_flete_bulto > 0` y `cantidadBultos > 1`:
  ```
  recargo = flete × (porcentaje / 100) × (cantidadBultos - 1)
  ```

### 4. `NewShipment.tsx`
- Leer `porcentaje_flete_bulto` de la tarifa seleccionada
- Si no multiplica por bultos pero tiene porcentaje y bultos > 1:
  ```
  fleteTotal = flete + flete × (porcentaje / 100) × (cantidadBultos - 1)
  ```

### 5. `Rates.tsx`
- Incluir `porcentaje_flete_bulto` en el save/load de la tarifa
- Inicializar en `'0'` por defecto

| Archivo | Cambio |
|---------|--------|
| Migración SQL | Columna `porcentaje_flete_bulto` |
| `CreateTarifaWizard.tsx` | Input porcentaje condicional |
| `TarifaSandbox.tsx` | Cálculo con porcentaje por bulto |
| `NewShipment.tsx` | Aplicar porcentaje en flete real |
| `Rates.tsx` | Guardar/cargar nuevo campo |


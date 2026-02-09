
# Actualizar Guia de Tarifas PDF con flujo completo y logica de calculo

## Resumen

Actualizar el contenido del PDF de tarifas (`src/lib/generateRatesGuidePDF.ts`) para reflejar con mayor precision el flujo real de carga de tarifas en la aplicacion y la logica de calculo implementada en el codigo. El PDF actual cubre los conceptos generales pero necesita alinearse mejor con la interfaz real y las formulas exactas.

## Cambios propuestos en el contenido del PDF

### Seccion 2: Tipos de Tarifas - Mejorar precision

- Aclarar que en tarifa por Peso, el metodo escalonado (rangos_kg) tiene **prioridad sobre el metodo simple** cuando ambos estan configurados
- Documentar que el **override por volumen** tiene la maxima prioridad: si alguna dimension del paquete supera el `umbral_volumen_cm` (por defecto 50cm), se usa el calculo volumetrico automaticamente, incluso en tarifas tipo "peso"
- Agregar la formula exacta del override: `Flete = Precio Base + (Volumen en m3 x Precio por m3)`

### Seccion 3: Crear Tarifa - Alinear con el formulario real

- Documentar que al crear/editar una tarifa, los **precios por concepto** se configuran inline en el mismo formulario (no en un paso separado)
- Aclarar que los conceptos activos aparecen automaticamente con campos de monto
- Documentar el switch de porcentaje vs monto fijo por concepto (especialmente para Seguro)
- Mencionar la opcion `multiplicar_por_bultos` a nivel de concepto individual

### Seccion 4: Conceptos - Actualizar

- Documentar que cada concepto puede tener precio fijo O porcentaje (con switch)
- Aclarar que `multiplicar_por_bultos` existe tanto a nivel tarifa (para el flete) como a nivel concepto individual
- Documentar el flujo de habilitar conceptos "Adicionales" por sucursal via `sucursal_conceptos`

### Seccion 6: Calculo del Flete - Agregar prioridades

Documentar la logica de prioridad exacta del calculo:

```
1. Override por Volumen (si dimension > umbral Y precio_por_m3 > 0)
2. Rangos Escalonados (rangos_kg, si existen y peso > 0)
3. Metodo Simple (peso_base_hasta + adicional_por_kg)
4. Precio Base (fallback)
```

Y luego:
- Multiplicar por bultos si esta activado
- Sumar conceptos basicos automaticos
- Sumar conceptos adicionales seleccionados
- Sumar seguro (formula de configuracion_seguro)

### Seccion 7: Seguro - Actualizar formula

Alinear con la implementacion real en `InsuranceConfigDialog`:
- `valorFinal = min(max(valorDeclarado, valor_minimo_declarado), valor_maximo_asegurado)`
- Si `valorFinal <= valor_minimo_declarado`: Seguro = seguro_base
- Si no: Seguro = seguro_base + ((valorFinal - valor_minimo_declarado) x porcentaje_excedente / 100)

### Seccion 8: Ajustes Masivos - Sin cambios mayores

El contenido actual esta correcto.

### Seccion 9: e-Commerce - Sin cambios mayores

El contenido actual esta correcto.

## Seccion tecnica

### Archivo afectado

- `src/lib/generateRatesGuidePDF.ts` - Actualizar el objeto `RATES_GUIDE_CONTENT` con los textos corregidos

### Detalle de cambios

Se modificaran las secciones 2, 3, 4, 6 y 7 del objeto `RATES_GUIDE_CONTENT` (lineas 33-405 aproximadamente) para reflejar:

1. **Seccion 2** (linea 33): Agregar parrafo sobre prioridad de calculo y override por volumen
2. **Seccion 3** (linea 117): Agregar paso sobre configuracion de conceptos inline y opciones de porcentaje/multiplicar por bultos
3. **Seccion 4** (linea 187): Agregar documentacion sobre switch porcentaje/fijo por concepto y multiplicar_por_bultos individual
4. **Seccion 6** (linea 298): Reescribir con la cadena de prioridad exacta del calculo
5. **Seccion 7** (linea 354): Actualizar formula para coincidir con `InsuranceConfigDialog`

No se modifica la estructura del PDF ni la logica de generacion (lineas 593-795), solo el contenido textual.

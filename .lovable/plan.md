## Objetivo
Configurar al chofer **Fernando Mauro** con comisiones por **zona / cordón AMBA**, según el mapa adjunto y los montos:

- CABA: $2.700
- 1° Cordón: $3.300
- 2° Cordón: $3.500
- 3° Cordón: $6.000

Hoy tiene `comision_tipo = 'porcentaje'` y **0 zonas cargadas** en `chofer_comisiones_zona`.

## Cambios

### 1. Cambiar tipo de comisión del chofer
`UPDATE profiles SET comision_tipo='zona'` para el chofer Fernando Mauro (id `e36b39bb-…c562dc`, tenant `94a9ea85-…c2ce`).

### 2. Insertar 39 reglas en `chofer_comisiones_zona`
Provincia = "Buenos Aires" (salvo CABA = "CABA"), `monto_fijo` según cordón, `activa = true`, `prioridad = 1`.

**CABA — $2.700**
- CABA / Capital Federal / Ciudad Autónoma de Buenos Aires (3 variantes para matching)

**1° Cordón — $3.300**
Vicente López, San Isidro, San Martín, Tres de Febrero, Hurlingham, Morón, Ituzaingó, La Matanza, Lanús, Avellaneda, Lomas de Zamora

**2° Cordón — $3.500**
Tigre, San Fernando, Malvinas Argentinas, José C. Paz, San Miguel, Moreno, Merlo, Ezeiza, Esteban Echeverría, Almirante Brown, Florencio Varela, Quilmes, Berazategui

**3° Cordón — $6.000**
Zárate, Campana, Escobar, Pilar, Luján, General Rodríguez, Marcos Paz, Cañuelas, Presidente Perón, San Vicente, La Plata, Ensenada, Berisso

> Nota: "Matanza Norte" y "Matanza Sur" del mapa se cargan ambas como **La Matanza** (1° cordón, $3.300), ya que el matching del motor de comisiones es por ciudad/partido (`ciudad_entrega`) y La Matanza es un solo partido. Si querés diferenciar Matanza Sur a $3.500 (2° cordón), decímelo antes y agrego variantes por CP.

### 3. Verificación
- Re-consultar `chofer_comisiones_zona` para confirmar 39 filas activas.
- Confirmar que `profiles.comision_tipo = 'zona'` para Fernando.
- Las próximas liquidaciones de chofer aplicarán automáticamente el motor de zonas (ver memoria `comisiones-chofer-por-zona`).

## Detalles técnicos
- Tabla: `public.chofer_comisiones_zona` (campos: `chofer_id`, `tenant_id`, `ciudad`, `provincia`, `monto_fijo`, `prioridad`, `activa`).
- Matching usa normalización por ciudad → fallback por provincia (memoria `comisiones-chofer-mapping-fallback`), por eso cargo nombres con tildes correctas.
- No se tocan tarifas de venta ni otros choferes.

## Preguntas antes de ejecutar
1. ¿Confirmás unificar **Matanza Norte + Matanza Sur** como **La Matanza a $3.300**, o querés Matanza Sur a $3.500?
2. ¿Querés que también agregue variantes sin tilde (ej. "Lanus", "Moron") para mejorar el matching con direcciones mal escritas? (Recomendado: sí.)

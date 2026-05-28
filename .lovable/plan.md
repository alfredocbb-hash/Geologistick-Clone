## Problema detectado

Hay **393 comisiones** de Fernando Mauro que quedaron en el fallback antiguo de **$2.459,04** (24%) y nunca fueron reclasificadas con las reglas de cordón. Son envíos entregados entre **7/abr y 20/may**, no liquidados aún.

Entre ellas hay muchas de **CABA** (Monte Castro, San Telmo, Palermo, Belgrano, Flores, Recoleta, Villa Crespo, Mataderos, Núñez, Saavedra, Parque Chacabuco, Colegiales, Floresta, Agronomía, Villa del Parque, La Boca, Balvanera, Constitución, etc.) que deberían cobrarse a **$2.700** y hoy figuran como fallback.

La causa es que la corrida anterior usó principalmente `ciudad_entrega` y muchas filas tienen el nombre del barrio (no "Capital Federal" / "CABA"), por lo que no matchearon. El **código postal** es mucho más confiable: en CABA cubre todo el rango **1000–1499**.

## Plan

Ejecutar un único UPDATE sobre las 393 comisiones pendientes (`monto = 2459.04` y `liquidacion_id IS NULL`) priorizando el CP por sobre el texto de ciudad, con este orden de reglas:

```text
1. CP numérico 1000–1499              → CABA          $2.700
2. CP numérico 1600–1699              → 1° Cordón     $3.300
3. CP numérico 1700–1799              → 1° Cordón     $3.300
4. CP numérico 1800–1899              → 2° Cordón     $3.500
5. CP numérico 1900–1999              → 2° Cordón     $3.500
6. CP numérico 2000+ (interior BA)    → 3° Cordón     $6.000
7. CP no numérico / vacío → fallback por ciudad (mismo mapeo de antes)
```

El CP se extrae con `regexp_replace(cp_entrega, '[^0-9]', '', 'g')::int` para tolerar formatos tipo `B1636`.

### Verificación post-update

Consulta para confirmar que ya no queden filas en $2.459,04 y que el desglose quede solo en $2.700 / $3.300 / $3.500 / $6.000, agrupado por monto y mostrando totales y cantidad de envíos.

### Casos puntuales a chequear manualmente

- **CP 6708 (Open Door)** y **CP 2814 (Los Cardales)** — no son CABA ni cordón clásico. Propongo dejarlos en $6.000 (3° cordón / interior). Confirmar.
- **CP 1024, 1044, 1065, 1130, 1162** (CABA microcentro/sur) — entran en regla 1 → $2.700. OK.

## Después

Una vez aplicado, hay que **regenerar la liquidación** desde la UI para que tome los nuevos montos. No se tocan comisiones ya liquidadas.

¿Confirmás avanzar con esta corrida? Si querés, antes te paso la lista completa de las 393 con su clasificación propuesta para revisión.

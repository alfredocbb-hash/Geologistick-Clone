Detecté por qué seguís viendo lo mismo: la base ya no tiene comisiones pendientes de $2.459,04 para Fernando, pero la pantalla al recalcular está priorizando match por ciudad antes que código postal. Además, la regla de CABA por CP está cargada como una lista larga con ciudad “CABA”, y el código actual sólo usa CP en reglas sin ciudad, entonces no entra por CP.

Plan de ajuste:

1. Corregir el matching de reglas por zona en `DriverSettlements`
   - Priorizar código postal antes que ciudad.
   - Permitir reglas con CP aunque también tengan ciudad cargada.
   - Soportar listas largas de CP y rangos.
   - Mantener fallback por ciudad/provincia sólo cuando no haya CP válido.

2. Mejorar la clasificación visible en la grilla
   - Mostrar como regla aplicada el CP/rango cuando matchee por CP, por ejemplo `CPs 1000...1439` o `CP 1000–1499`, en vez de “sin match → fallback chofer”.

3. Verificar contra datos reales
   - Confirmar que la consulta de comisiones pendientes ya no tiene $2.459,04.
   - Confirmar que el cálculo nuevo para los envíos con CP CABA devuelve $2.700 antes de generar la liquidación.

Resultado esperado: al apretar “Calcular” nuevamente, ya no debería aparecer el fallback de $2.459,04 para barrios/CP de CABA; debería tomar $2.700/$3.300/$3.500/$6.000 según CP/zona.
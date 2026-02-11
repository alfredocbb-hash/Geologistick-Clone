

# Corregir Zonas de Tarifas para Envios ML Flex

## Problema detectado

Los envios Flex SI estan vinculados correctamente a los sellers (via `remitente_id` = `cliente_id`), pero no se ven en la liquidacion por dos razones:

1. **Fecha por defecto**: La liquidacion muestra el mes anterior. Los envios son del mes actual.
2. **Zonas incompletas**: La Zona 3 solo tiene "Capital Federal" como `zona_destino`, pero deberia cubrir todo el resto de GBA/CABA. Ciudades como Monte Grande, Lomas de Zamora, Escobar, Jose C. Paz, Tristan Suarez, etc. no matchean con ninguna zona y quedan con precio $0.

### Ciudades de envios actuales sin match de zona:
- tristan suarez, Monte Grande, Jose C. Paz, Escobar, Lomas de Zamora, Jose Leon Suarez, La Matanza, Zelaya, La Plata

## Solucion

### 1. Actualizar la tarifa Zona 3 para incluir todas las localidades de GBA/CABA

Agregar todas las localidades conocidas de GBA y CABA al campo `zona_destino` de la tarifa "Zona 3 - CABA Y GBA", separadas por coma:

```text
Capital Federal,CABA,Buenos Aires,Avellaneda,Lanus,Lomas de Zamora,
Almirante Brown,Esteban Echeverria,Ezeiza,Monte Grande,La Matanza,
Moron,Ituzaingo,Hurlingham,Tres de Febrero,San Martin,Jose C. Paz,
San Miguel,Malvinas Argentinas,Tigre,San Fernando,San Isidro,
Vicente Lopez,Escobar,Pilar,Campana,Zarate,Merlo,Moreno,
Jose Leon Suarez,Tristan Suarez,Zelaya,Temperley,Adrogue,
Banfield,Gerli,Wilde,Sarandi,Bernal,Don Bosco,San Francisco Solano,
Rafael Calzada,Longchamps,Glew,Burzaco,Claypole,
Gonzalez Catan,Isidro Casanova,Gregorio de Laferrere,
Ciudad Evita,Ramos Mejia,Haedo,Castelar,El Palomar,
Caseros,Ciudadela,Santos Lugares,Villa Sarmiento,
Martinez,Olivos,Florida,Munro,Villa Ballester,
General Pacheco,Don Torcuato,Benavidez,Garin,Maschwitz
```

### 2. Crear tarifa Zona 4 - La Plata

Crear una nueva tarifa de zona con:
- nombre: "Zona 4 - La Plata"
- tipo_tarifa: "zona"
- zona_destino: "La Plata,City Bell,Gonnet,Tolosa,Los Hornos,Ensenada,Berisso"
- precio_base: 10245.99

### 3. Implementar logica de zona "catch-all"

Modificar la logica de matching en `register-ml-shipment` y `mercadolibre-sync` para que si ninguna zona especifica matchea, se use la zona con el nombre que contenga "GBA" o "CABA" como fallback. Esto evita que ciudades nuevas queden sin precio.

### 4. Cambiar fecha por defecto en Settlements

Cambiar el rango de fechas por defecto en la pagina de liquidaciones para que muestre el **mes actual** en lugar del mes anterior. El mes anterior es util para liquidaciones ya cerradas, pero confunde cuando se quieren ver envios recientes.

## Cambios por archivo

| Archivo | Cambio |
|---------|--------|
| Migracion SQL | UPDATE tarifa Zona 3 con localidades completas. INSERT tarifa Zona 4 La Plata |
| `supabase/functions/register-ml-shipment/index.ts` | Agregar logica fallback: si no hay match exacto de zona, usar la tarifa con zona_destino mas amplia (que contenga "GBA" o sea la de mayor cantidad de ciudades) |
| `supabase/functions/mercadolibre-sync/index.ts` | Misma logica de fallback |
| `src/pages/ecommerce/Settlements.tsx` | Cambiar fechas por defecto al mes actual en vez del anterior |

## Detalle tecnico

### Migracion SQL

```text
-- Actualizar Zona 3 con todas las localidades de GBA/CABA
UPDATE tarifas SET zona_destino = 'Capital Federal,CABA,...(todas las localidades)'
WHERE id = '2475afe9-1982-4cff-a20b-967f2ba977ee';

-- Crear Zona 4 - La Plata
INSERT INTO tarifas (nombre, tipo_tarifa, zona_destino, precio_base, tenant_id, activa)
VALUES ('Zona 4 - La Plata', 'zona', 'La Plata,City Bell,Gonnet,...', 10245.99, '94a9ea85-...', true);
```

### Logica de fallback en edge functions

```text
// Despues del loop normal de matching:
if (precioTotal === 0 && zoneTarifas.length > 0) {
  // Fallback: usar la tarifa de zona con mas ciudades listadas (la mas amplia)
  const fallback = zoneTarifas
    .filter(t => t.zona_destino && t.zona_destino.split(',').length > 3)
    .sort((a, b) => b.zona_destino.split(',').length - a.zona_destino.split(',').length)[0];
  if (fallback) {
    precioTotal = fallback.precio_base;
    tarifaMetodo = 'zona_fallback';
  }
}
```

### Cambio de fechas en Settlements.tsx

```text
// Antes (mes anterior):
const [fechaInicio, setFechaInicio] = useState(startOfMonth(subMonths(new Date(), 1)));
const [fechaFin, setFechaFin] = useState(endOfMonth(subMonths(new Date(), 1)));

// Despues (mes actual):
const [fechaInicio, setFechaInicio] = useState(startOfMonth(new Date()));
const [fechaFin, setFechaFin] = useState(endOfMonth(new Date()));
```

## Resultado esperado

1. Al calcular liquidacion con fechas de febrero, apareceran todos los envios Flex
2. Los envios con ciudad conocida (Berazategui, Quilmes, etc.) tendran precio por zona
3. Los envios con ciudades de GBA no listadas usaran la tarifa fallback (Zona 3)
4. La Plata y alrededores usaran la nueva Zona 4


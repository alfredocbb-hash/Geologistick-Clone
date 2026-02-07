

# Corregir validacion de cobertura para sub-localidades

## Problema

El error "Sin cobertura en Berazategui Oeste" ocurre porque la validacion de zonas de cobertura usa comparacion exacta de ciudad. La zona esta configurada como **"Berazategui"**, pero Google Maps devuelve **"Berazategui Oeste"** como nombre de la localidad. Al comparar `"berazategui" === "berazategui oeste"`, no coinciden y se bloquea el envio.

Este mismo problema afectaria a cualquier sub-localidad como "La Plata Centro", "Zarate Norte", etc.

## Solucion

Cambiar la comparacion de ciudades de **igualdad exacta** a **coincidencia parcial (includes)**. Si la ciudad de destino contiene el nombre de la zona configurada, o viceversa, se considera como match valido.

Por ejemplo:
- Zona: "Berazategui" → matchea con "Berazategui Oeste", "Berazategui Centro", etc.
- Zona: "La Plata" → matchea con "La Plata Norte", "City Bell, La Plata", etc.

## Cambio tecnico

**Archivo**: `src/hooks/useCoverageValidation.ts`

En la funcion `validateDestination`, lineas 71-75, cambiar la comparacion de ciudades de:

```typescript
if (normalize(zone.ciudad) === destCiudad) {
  matches = true;
}
```

a:

```typescript
const zoneCiudad = normalize(zone.ciudad);
if (zoneCiudad === destCiudad || 
    destCiudad.includes(zoneCiudad) || 
    zoneCiudad.includes(destCiudad)) {
  matches = true;
}
```

De la misma forma para la comparacion de provincias (lineas 78-81), aplicar el mismo patron de includes.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useCoverageValidation.ts` | Cambiar comparacion exacta por includes en ciudad y provincia |

## Resultado esperado

- "Berazategui Oeste" matchea con la zona "Berazategui" y se permite crear el envio
- Las zonas configuradas por rango de codigo postal (CABA, Zona Norte, etc.) no se ven afectadas ya que usan otra logica
- No se afecta la seguridad ni se abren zonas no deseadas, ya que la coincidencia parcial es direccional (la zona configurada debe estar contenida en el destino)


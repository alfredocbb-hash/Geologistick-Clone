
# Corrección: Error `generationTime` inválido en WSAA de AFIP

## Causa raíz identificada (confirmada en logs)

El log del edge function muestra exactamente el error:

```
faultcode: ns1:xml.generationTime.invalid
faultstring: generationTime posee formato o dato inválido (ej: en el futuro o más de 24 horas de antigüedad)
```

Y el TRA generado fue:
```xml
<generationTime>2026-02-18T06:15:48.252-03:00</generationTime>
```

El edge function corre en UTC. La hora real era las `06:15 UTC`. El código hace `.toISOString()` (que da UTC) y luego reemplaza la `Z` por `-03:00`:

```
"2026-02-18T06:15:48.252Z"  →  "2026-02-18T06:15:48.252-03:00"
```

AFIP interpreta `06:15-03:00` como las **9:15 UTC** (es decir, 6:15 de la mañana en Argentina = 9:15 UTC). Pero el momento real era las **6:15 UTC** → AFIP ve una fecha **3 horas en el futuro** y la rechaza con el error de `generationTime inválido`.

## Solución

Para representar correctamente la hora de Argentina con offset `-03:00`, hay que restar 3 horas al tiempo UTC **antes** de aplicar el sufijo. Así `06:15 UTC - 3h = 03:15` y el string `03:15-03:00` equivale correctamente a `06:15 UTC`.

### Cambio en `generarTRA()` (líneas 298-317 de `supabase/functions/arca-factura/index.ts`):

**Antes (incorrecto):**
```typescript
function generarTRA(): string {
  const now = new Date();
  const genTime = new Date(now.getTime() - 60000);
  const expTime = new Date(now.getTime() + 600000);

  const fmt = (d: Date) => {
    const iso = d.toISOString();
    return iso.replace('Z', '-03:00');  // ← BUG: UTC time con sufijo -03:00
  };
  ...
}
```

**Después (correcto):**
```typescript
function generarTRA(): string {
  const now = new Date();
  // Ajustar la hora a Argentina (UTC-3) restando 3 horas
  // antes de aplicar el sufijo -03:00
  const AR_OFFSET_MS = 3 * 60 * 60 * 1000; // 3 horas en ms
  const genTime = new Date(now.getTime() - 60000);   // 1 min antes
  const expTime = new Date(now.getTime() + 600000);  // 10 min después

  const fmt = (d: Date) => {
    // Restar 3 horas (UTC → Argentina) y aplicar el sufijo
    const argTime = new Date(d.getTime() - AR_OFFSET_MS);
    return argTime.toISOString().replace('Z', '-03:00');
  };
  ...
}
```

Con esto, si el momento real es `09:15 UTC`:
- `argTime` = `09:15 - 3h = 06:15`
- String generado = `"2026-02-18T06:15:00-03:00"`
- AFIP lo interpreta como `06:15 + 3h = 09:15 UTC` ✓

## Archivo a modificar

- **`supabase/functions/arca-factura/index.ts`**: Solo la función `generarTRA()` (líneas 298-317), reemplazando el helper `fmt` para que reste 3 horas antes de agregar el offset.

## Resultado esperado

Con este fix, el WSAA debería:
1. Aceptar el TRA como válido (generationTime correcto)
2. Devolver el Token y Sign
3. Permitir que WSFEv1 emita el CAE

**Nota:** Si el certificado de Beraexpress es de homologación (CN: `testafipberaexpress`) seguirá fallando con el error `cms.cert.untrusted` en producción. Pero este fix es necesario independientemente ya que el error de generationTime bloquea incluso antes de verificar el certificado. Una vez corregida la fecha, si sigue el error de certificado, Beraexpress deberá obtener su certificado de producción de AFIP.

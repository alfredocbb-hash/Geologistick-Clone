
## Diagnóstico definitivo del error ARCA

### Evidencia de los logs en tiempo real

Los logs de la función revelan que el XML calculado **sí es correcto** en cuanto a montos:
- `total=7221.98, neto=5968.58, iva=1253.40` ✓ (cálculo correcto)

Sin embargo AFIP rechaza por **dos razones distintas** según el ambiente:

**Producción** (WSFEv1 v6.1): código 10070
```
"Si ImpNeto es mayor a 0, el objeto AlicIva es obligatorio y no debe ser nulo."
```
→ El bloque `<ar:Iva>` llega pero los elementos internos `<AlicIva>`, `<Id>`, `<BaseImp>`, `<Importe>` **no tienen el prefijo de namespace `ar:`**, entonces el parser SOAP de AFIP los descarta y el bloque queda vacío.

**Sandbox** (WSFEv1 v7.0): código 10246
```
"Campo Condicion Frente al IVA del receptor es obligatorio conforme a RG 5616."
```
→ El tag `<ar:CondicionIvaReceptorId>` está en el XML pero la interpolación con espacios de indentación hace que se genere mal en algunos parsers. Además, en sandbox v7 este campo es **obligatorio** y si no se parsea correctamente se rechaza.

### Causa raíz técnica

El bloque IVA actualmente generado es:
```xml
<ar:Iva><AlicIva><Id>5</Id><BaseImp>5968.58</BaseImp><Importe>1253.40</Importe></AlicIva></ar:Iva>
```

Los elementos internos `<AlicIva>`, `<Id>`, `<BaseImp>`, `<Importe>` **NO tienen el prefijo `ar:`**. El namespace `xmlns:ar="http://ar.gov.afip.dif.FEV1/"` está declarado en el Envelope, pero el parser estricto de AFIP exige que **todos** los elementos dentro de `FECAEDetRequest` usen el prefijo `ar:`. Sin ese prefijo, AFIP trata los elementos como no pertenecientes al namespace y los ignora → `AlicIva` queda nulo.

También el `${ivaBlock}` interpolado con sangría de 12 espacios antes puede generar un nodo de texto vacío en algunos parsers SOAP.

### Corrección a aplicar en `supabase/functions/arca-factura/index.ts`

**Cambio 1**: Todos los elementos del bloque IVA deben llevar el prefijo `ar:`:

```typescript
// ANTES (incorrecto — sin namespace en elementos internos):
const ivaBlock = importeIva > 0.005
  ? `<ar:Iva><AlicIva><Id>5</Id><BaseImp>...</BaseImp><Importe>...</Importe></AlicIva></ar:Iva>`
  : '';

// DESPUÉS (correcto — todos los elementos con prefijo ar:):
const ivaBlock = importeIva > 0.005
  ? `<ar:Iva><ar:AlicIva><ar:Id>5</ar:Id><ar:BaseImp>${importeNeto.toFixed(2)}</ar:BaseImp><ar:Importe>${importeIva.toFixed(2)}</ar:Importe></ar:AlicIva></ar:Iva>`
  : '';
```

**Cambio 2**: Mover `<ar:CondicionIvaReceptorId>` y `${ivaBlock}` dentro del XML sin sangría variable que pueda generar nodos de texto:

El XML del request debe verse así:
```xml
<ar:MonCotiz>1</ar:MonCotiz><ar:CondicionIvaReceptorId>5</ar:CondicionIvaReceptorId><ar:Iva><ar:AlicIva><ar:Id>5</ar:Id><ar:BaseImp>5968.58</ar:BaseImp><ar:Importe>1253.40</ar:Importe></ar:AlicIva></ar:Iva>
```

**Cambio 3**: Agregar log del XML generado para facilitar futuros diagnósticos:
```typescript
console.log('[ARCA] SOAP body IVA section:', `CondicionIva=${condicionIvaReceptorNumero}, ivaBlock=${ivaBlock}`);
```

### Archivos a modificar

| Archivo | Líneas | Cambio |
|---|---|---|
| `supabase/functions/arca-factura/index.ts` | 553-554 | Agregar prefijo `ar:` a todos los elementos internos del bloque IVA |
| `supabase/functions/arca-factura/index.ts` | 589-594 | Colocar `CondicionIvaReceptorId` e `ivaBlock` en línea continua sin indentación variable |

### Resultado esperado

AFIP producción y sandbox aceptarán el XML porque:
- `<ar:Iva><ar:AlicIva><ar:Id>5</ar:Id>...` → namespace correcto en todos los nodos
- `<ar:CondicionIvaReceptorId>5</ar:CondicionIvaReceptorId>` → sin nodos de texto previos
- IVA 21%: neto=5968.58 + iva=1253.40 = total=7221.98 ✓

### También: Desglose de IVA en el diálogo de emisión

El usuario menciona que "debería mostrar el desglose de IVA con 21%". Actualmente el `InvoiceDataDialog` solo muestra el importe total. Se agregará un cuadro de desglose que muestre:
- Neto (sin IVA 21%): `total / 1.21`
- IVA 21%: `total - neto`
- Total: `total`

Esto se agrega al bloque de "Importe" en el dialog para que el operador sepa exactamente qué montos se enviarán a AFIP.



# Plan: Tabs "Emisión" y "Recepción" con los Mismos Conceptos

## Resumen

Implementar dos solapas en el diálogo de comisiones donde **ambas muestran los mismos conceptos** pero con configuraciones independientes:

- **Emisión**: Porcentajes cuando la sucursal DESPACHA envíos
- **Recepción**: Porcentajes cuando la sucursal RECIBE envíos

## Ejemplo del Flujo

```text
Sucursal Berazategui (Origen)          Sucursal Rosario (Destino)
         |                                      |
         |--- Despacha envío ------------------>|
         |                                      |
    Comisiona por                          Comisiona por
      EMISIÓN                               RECEPCIÓN
   (Flete 5%, Seguro 10%...)             (Flete 3%, Seguro 8%...)
```

---

## Parte 1: Migración de Base de Datos

Agregar campo `tipo_rol` a `sucursal_comisiones` para distinguir las configuraciones:

```sql
ALTER TABLE sucursal_comisiones 
ADD COLUMN IF NOT EXISTS tipo_rol text DEFAULT 'emision'
CHECK (tipo_rol IN ('emision', 'recepcion'));

-- Índice único para permitir mismo concepto con diferentes roles
CREATE UNIQUE INDEX IF NOT EXISTS sucursal_comisiones_unique_rol 
ON sucursal_comisiones (sucursal_id, concepto_id, tipo_rol);
```

---

## Parte 2: Modificar Diálogo de Comisiones

### Archivo: `src/pages/Branches.tsx`

### Estructura Visual del Diálogo

```text
+-----------------------------------------------------+
| Comisiones - [Nombre Sucursal]                  [X] |
+-----------------------------------------------------+
|  +------------------+-------------------+           |
|  |     Emisión      |     Recepción     |           |
|  +------------------+-------------------+           |
|                                                     |
|  Tab: Emisión                                       |
|  "Comisiones cuando esta sucursal DESPACHA envíos"  |
|  +----------+--------+--------+--------+---------+  |
|  | Concepto | %Cont. | %Dest. | %CC    | Base    |  |
|  +----------+--------+--------+--------+---------+  |
|  | Flete    |  5     |   3    |  4     | Total   |  |
|  | Seguro   |  10    |   8    |  10    | Neto    |  |
|  | Embalaje |  2     |   2    |  2     | Total   |  |
|  | Retiro   |  3     |   3    |  3     | Flete   |  |
|  | ...      |  ...   |  ...   |  ...   | ...     |  |
|  +----------+--------+--------+--------+---------+  |
|                                                     |
|  Tab: Recepción                                     |
|  "Comisiones cuando esta sucursal RECIBE envíos"    |
|  +----------+--------+--------+--------+---------+  |
|  | Concepto | %Cont. | %Dest. | %CC    | Base    |  |
|  +----------+--------+--------+--------+---------+  |
|  | Flete    |  3     |   2    |  3     | Total   |  |
|  | Seguro   |  8     |   6    |  8     | Neto    |  |
|  | Embalaje |  1     |   1    |  1     | Total   |  |
|  | Retiro   |  0     |   0    |  0     | Flete   |  |
|  | ...      |  ...   |  ...   |  ...   | ...     |  |
|  +----------+--------+--------+--------+---------+  |
|                                                     |
|                    [Cancelar]  [Guardar Comisiones] |
+-----------------------------------------------------+
```

### Cambios en el Código

1. Agregar estado para la pestaña activa
2. Dos objetos de datos separados: `emisionCommissionData` y `recepcionCommissionData`
3. **Ambas pestañas muestran TODOS los conceptos** (sin filtrar)
4. Al guardar, cada concepto se guarda dos veces: una con `tipo_rol = 'emision'` y otra con `tipo_rol = 'recepcion'`

---

## Parte 3: Actualizar Lógica de Liquidaciones

### Archivo: `src/pages/BranchSettlements.tsx`

### Modificar query de envíos

Incluir envíos donde la sucursal es origen O destino:

```typescript
.or(`sucursal_origen_id.eq.${selectedSucursal},sucursal_destino_id.eq.${selectedSucursal}`)
```

### Lógica de cálculo

```typescript
for (const envio of envios) {
  const esOrigen = envio.sucursal_origen_id === selectedSucursal;
  const esDestino = envio.sucursal_destino_id === selectedSucursal;

  if (esOrigen) {
    // Usar comisiones con tipo_rol = 'emision'
    // Aplicar todos los conceptos configurados
  }

  if (esDestino && envio.estado === 'entregado') {
    // Usar comisiones con tipo_rol = 'recepcion'
    // Aplicar todos los conceptos configurados
  }
}
```

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| Nueva migración SQL | Agregar campo `tipo_rol` e índice único |
| `src/pages/Branches.tsx` | Agregar Tabs, estados separados, mostrar mismos conceptos en ambas, modificar guardado con tipo_rol |
| `src/pages/BranchSettlements.tsx` | Query OR, buscar comisiones por tipo_rol según rol de la sucursal en cada envío |

---

## Ejemplo Práctico

**Sucursal Berazategui envía a Sucursal Rosario:**

| Campo | Valor |
|-------|-------|
| Precio Total | $10,000 |
| Tipo Pago | destino |

**Configuración Sucursal Berazategui:**
- Emisión → Flete: 5%
- Recepción → Flete: 3%

**Configuración Sucursal Rosario:**
- Emisión → Flete: 4%
- Recepción → Flete: 2%

**Liquidación Sucursal Berazategui (es ORIGEN → usa EMISIÓN):**
- Flete: 5% de $10,000 = **$500**

**Liquidación Sucursal Rosario (es DESTINO → usa RECEPCIÓN):**
- Flete: 2% de $10,000 = **$200**
- Total cobrado: $10,000 (canjeó el envío porque es pago destino)

---

## Sección Técnica

### Implementación de la Interface

```typescript
interface SucursalComision {
  id: string;
  sucursal_id: string;
  concepto_id: string;
  porcentaje_contado: number;
  porcentaje_destino: number;
  porcentaje_cta_cte: number;
  base_comision: string;
  tipo_rol: 'emision' | 'recepcion';
}
```

### Estados del Diálogo

```typescript
const [commissionTab, setCommissionTab] = useState<'emision' | 'recepcion'>('emision');
const [emisionCommissionData, setEmisionCommissionData] = useState<Record<string, CommissionValues>>({});
const [recepcionCommissionData, setRecepcionCommissionData] = useState<Record<string, CommissionValues>>({});
```

### Cargar datos existentes

```typescript
useEffect(() => {
  // Cargar comisiones de EMISIÓN
  const emisionData = {};
  conceptos.forEach(concepto => {
    const existing = sucursalComisiones.find(
      c => c.concepto_id === concepto.id && c.tipo_rol === 'emision'
    );
    emisionData[concepto.id] = { /* valores o defaults */ };
  });
  setEmisionCommissionData(emisionData);

  // Cargar comisiones de RECEPCIÓN
  const recepcionData = {};
  conceptos.forEach(concepto => {
    const existing = sucursalComisiones.find(
      c => c.concepto_id === concepto.id && c.tipo_rol === 'recepcion'
    );
    recepcionData[concepto.id] = { /* valores o defaults */ };
  });
  setRecepcionCommissionData(recepcionData);
}, [conceptos, sucursalComisiones]);
```

### Guardar comisiones

Al guardar, se crean/actualizan registros para ambos roles:
- Un registro por cada concepto con `tipo_rol = 'emision'`
- Un registro por cada concepto con `tipo_rol = 'recepcion'`


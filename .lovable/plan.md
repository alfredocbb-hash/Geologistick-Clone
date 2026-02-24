

# Implementar Liquidaciones de Terciarizados con IVA

## Resumen

Agregar un flujo completo de liquidaciones para empresas terciarizadas, incluyendo calculo automatico de envios entregados en un periodo, generacion formal de liquidaciones, gestion del ciclo de vida (pagar/cancelar), y soporte para IVA configurable por empresa.

## Cambios en Base de Datos

### 1. Agregar columnas IVA a `empresas_terciarizadas`

Dos nuevas columnas para configurar si la empresa trabaja con IVA incluido y que porcentaje aplica (igual que sucursales):

| Columna | Tipo | Default | Descripcion |
|---|---|---|---|
| incluye_iva | boolean | false | Si la empresa factura con IVA |
| porcentaje_iva | numeric | 21 | Porcentaje de IVA aplicable |

### 2. Nueva tabla: `liquidaciones_terciarizado`

| Columna | Tipo | Default |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| empresa_id | uuid FK -> empresas_terciarizadas | - |
| periodo_inicio | date | - |
| periodo_fin | date | - |
| monto_total | numeric | 0 |
| monto_iva | numeric | 0 |
| monto_neto | numeric | 0 |
| cantidad_envios | integer | 0 |
| estado | text | 'generada' |
| notas | text | null |
| metodo_pago | text | null |
| referencia_pago | text | null |
| fecha_pago | timestamptz | null |
| generado_por | uuid | null |
| tenant_id | uuid | null |
| created_at | timestamptz | now() |

### 3. Nueva tabla: `liquidacion_terciarizado_detalles`

| Columna | Tipo | Default |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| liquidacion_id | uuid FK -> liquidaciones_terciarizado | - |
| envio_id | uuid FK -> envios | - |
| monto | numeric | 0 |
| created_at | timestamptz | now() |

### 4. Politicas RLS

- Admin y supervisor pueden gestionar (INSERT, UPDATE, DELETE no pagadas, SELECT)
- Mismo patron que `liquidaciones_sucursal`

## Cambios en Frontend

### Archivo: `src/pages/ThirdPartyCompanies.tsx`

Agregar los campos `incluye_iva` y `porcentaje_iva` al formulario de creacion/edicion de empresas terciarizadas (un Switch para activar IVA y un Input para el porcentaje).

### Archivo: `src/pages/ThirdPartySettlements.tsx`

Reescribir con dos tabs principales:

**Tab "Liquidaciones"** (nueva):
- Seleccionar empresa + rango de fechas
- Boton "Calcular" que busca envios entregados (`estado = 'entregado'`, `es_terciarizado = true`, `empresa_terciarizada_id = empresa`) en el periodo
- Tabla de envios encontrados con tracking, destinatario, fecha entrega, monto
- Resumen: subtotal, IVA (si la empresa tiene `incluye_iva = true`, desglosa neto + IVA al porcentaje configurado), total
- Boton "Generar Liquidacion":
  - Crea registro en `liquidaciones_terciarizado` (con monto_total, monto_iva, monto_neto)
  - Crea detalles en `liquidacion_terciarizado_detalles`
  - Registra cargo en `terciarizado_cuenta_corriente`
  - Actualiza `saldo_cuenta_corriente` de la empresa
- Historial de liquidaciones con acciones: pagar, cancelar

**Tab "Cuenta Corriente"** (existente):
- Sin cambios: selector de empresa, saldo, historial de movimientos, pagos/ajustes

### Logica de IVA en la liquidacion

```text
Si empresa.incluye_iva = true:
  monto_neto = monto_total / (1 + porcentaje_iva/100)
  monto_iva  = monto_total - monto_neto
Si empresa.incluye_iva = false:
  monto_neto = monto_total
  monto_iva  = 0
```

El desglose se muestra en la calculadora y se guarda en la liquidacion para referencia futura.

## Flujo completo

```text
1. Configurar empresa con IVA (ThirdPartyCompanies)
2. Ir a Liquidaciones Terciarizados
3. Tab "Liquidaciones" > Seleccionar empresa + fechas
4. Calcular > Ver envios entregados + desglose IVA
5. Generar Liquidacion > Se crea liquidacion + cargo en cta cte
6. Pagar liquidacion > Se registra pago en cta cte
7. (Opcional) Cancelar > Se revierte el cargo
```

## Archivos a modificar/crear

| Archivo | Accion | Descripcion |
|---|---|---|
| Migracion SQL | Crear | Columnas IVA en empresas_terciarizadas + tablas liquidaciones_terciarizado y liquidacion_terciarizado_detalles con RLS |
| `src/pages/ThirdPartyCompanies.tsx` | Modificar | Agregar campos incluye_iva y porcentaje_iva al formulario |
| `src/pages/ThirdPartySettlements.tsx` | Modificar | Agregar tab de liquidaciones con calculadora, IVA, generacion, historial y acciones; mover contenido actual a tab "Cuenta Corriente" |


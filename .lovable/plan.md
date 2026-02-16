

# Corregir Saldo Final en Liquidaciones de Sellers

## Problema

El "Saldo Final" muestra $30,737.97 (el saldo actual de la cuenta corriente del seller en la base de datos) en lugar de calcularse a partir de los valores del periodo. Deberia ser: `Saldo Anterior + Envios del Periodo - Pagos del Periodo`.

## Cambio

### `src/pages/ecommerce/Settlements.tsx` (linea 685)

Cambiar:
```
saldo_final: seller?.saldo_cuenta_corriente || 0,
```

Por:
```
saldo_final: (sellerMovs[0]?.saldo_anterior || 0) + sellerTotalEnvios - sellerTotalPagos,
```

Esto hara que el Saldo Final sea consistente con el calculo visible:
- Saldo Anterior: $0
- Envios del Periodo: +$40,983.96
- Pagos del Periodo: -$0
- **Saldo Final: $40,983.96**



# Fix: Concepto "Retiro a Domicilio" se cobra en servicio "Sucursal a Puerta"

## Problema

Cuando un usuario de BeraExpress (u otra empresa con codigos prefijados) selecciona el tipo de servicio **"Sucursal a Puerta"**, el concepto **"Retiro a Domicilio"** se incluye en el precio. Esto es incorrecto porque en ese tipo de servicio no hay retiro a domicilio.

## Causa Raiz

En `NewShipment.tsx` (linea 384-386), el filtro de conceptos por tipo de servicio usa comparacion estricta:

```
const codigo = cp.concepto?.codigo?.toLowerCase();
if (codigo === 'retiro' && !tieneRetiro) return false;
if (codigo === 'entrega' && !tieneEntrega) return false;
```

Esto solo funciona para tenants cuyo codigo sea exactamente `retiro` o `entrega`. Pero BeraExpress usa codigos con prefijo: `BE-RETIRO` y `BE-ENTREGA`. Al convertir a minusculas: `be-retiro` !== `retiro`, por lo que el filtro no los excluye.

**Resultado**: Para "Sucursal a Puerta", el concepto "Retiro a Domicilio" (`BE-RETIRO`) pasa el filtro y se suma al precio.

Otros tenants afectados:
- Tenant `81be07a7...` usa `RETIRO` / `ENTREGA` (funciona bien, coincide en lowercase)
- Tenant `3df5f6f8...` usa `PB-ENTREGA` (tambien afectado, no filtra entrega correctamente)

## Solucion

Cambiar la comparacion estricta (`===`) por `includes()` para que detecte el codigo sin importar el prefijo:

```typescript
if (codigo?.includes('retiro') && !tieneRetiro) return false;
if (codigo?.includes('entrega') && !tieneEntrega) return false;
```

Esto cubrira todos los formatos: `retiro`, `RETIRO`, `BE-RETIRO`, `PB-RETIRO`, etc.

## Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/NewShipment.tsx` | Linea 385-386: Cambiar `===` por `.includes()` en filtro de conceptos |

## Sin cambios de base de datos
No se necesitan migraciones.

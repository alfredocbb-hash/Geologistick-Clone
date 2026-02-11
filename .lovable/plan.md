

# Corregir: No deja crear envio por caja + conceptos duplicados

## Problema 1: "No hay caja abierta" al crear envio

La pagina de Nuevo Envio (`NewShipment.tsx`) tiene el mismo bug que ya corregimos en la pagina de Caja: usa `.maybeSingle()` para buscar la sesion de caja abierta. Como el usuario tiene multiples sesiones abiertas (4 sesiones huerfanas), esta consulta falla silenciosamente y la UI muestra "No hay caja abierta".

### Solucion

**Archivo:** `src/pages/NewShipment.tsx` (linea ~349-357)

Reemplazar `.maybeSingle()` por `.order('created_at', { ascending: false }).limit(1)` y tomar el primer resultado, identico al fix que ya hicimos en `Cash.tsx`:

```
// Antes (linea 354)
.maybeSingle()

// Despues
.order('created_at', { ascending: false })
.limit(1)
```

Y ajustar el return para tomar `data[0]` en lugar de `data` directamente.

---

## Problema 2: Conceptos "duplicados" en tarifas

Revise la base de datos y **no hay duplicados reales** en las tablas `tarifa_conceptos` ni `tarifa_concepto_precios`. Sin embargo, el tenant de Bera Express tiene dos conceptos que se ven iguales:

- `traslado` (codigo: `tras`, basico: si)
- `TRASLADO` (codigo: `trasl`, basico: no)

Son registros distintos creados manualmente. Si quieres eliminar uno de ellos, puedo hacerlo como un paso adicional. No es un error del sistema sino datos ingresados por duplicado.

---

## Resumen de cambios

| Archivo | Cambio |
|---------|--------|
| `src/pages/NewShipment.tsx` | Corregir consulta de caja abierta (`.maybeSingle()` a `.limit(1)`) |

## Sin cambios de base de datos
No se necesitan migraciones.

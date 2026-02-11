

# Corregir: Caja abierta no se registra (múltiples sesiones abiertas)

## Problema

El usuario `alfredobernard@beraexpress.com` tiene 4 sesiones de caja con estado `abierta` en la misma sucursal (nunca fueron cerradas). La consulta que busca la sesion activa usa `.maybeSingle()`, que lanza un error silencioso cuando hay mas de 1 fila. Esto hace que la UI muestre "sin sesion abierta" y permite abrir mas sesiones sin ver las anteriores.

## Causa raiz

En `src/pages/Cash.tsx`, linea 171:
```
const { data, error } = await query.maybeSingle();
```

Cuando hay multiples sesiones abiertas, `maybeSingle()` falla porque espera 0 o 1 resultado.

## Solucion

### Archivo: `src/pages/Cash.tsx`

**Cambio 1 - Consulta de sesion activa (linea ~160-173)**

Reemplazar `.maybeSingle()` por `.order('created_at', { ascending: false }).limit(1)` y tomar el primer resultado. Esto devuelve la sesion abierta mas reciente sin fallar si hay varias.

```typescript
// Antes
const { data, error } = await query.maybeSingle();
if (error) throw error;
return data as CashSession | null;

// Despues
const { data, error } = await query
  .order('created_at', { ascending: false })
  .limit(1);
if (error) throw error;
return (data && data.length > 0 ? data[0] : null) as CashSession | null;
```

**Cambio 2 - Prevenir apertura duplicada**

En la mutacion `openSessionMutation` (linea ~223), agregar una verificacion previa: si ya existe una sesion abierta (`currentSession` no es null), mostrar un error y no crear una nueva.

```typescript
if (currentSession) {
  throw new Error('Ya existe una sesión de caja abierta');
}
```

## Sin cambios de base de datos
No se necesitan migraciones. Los datos existentes (sesiones huerfanas) se podran ver y cerrar normalmente una vez aplicado el fix.


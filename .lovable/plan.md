
# Plan: Permitir al Chofer Crear Rutas desde Modo Flex

## Problema Detectado

El error "Error al crear ruta" ocurre porque la politica de seguridad (RLS) de la tabla `rutas_planificadas` **no permite que un chofer cree rutas**. Solo permite a admin, supervisor y operador.

**Politica actual:**
```text
"Gestionar rutas planificadas" (INSERT/UPDATE/DELETE):
  is_admin() OR has_role('supervisor') OR has_role('operador')
```

El chofer solo puede VER sus rutas, pero no CREAR nuevas. Cuando toca "INICIAR REPARTO", el INSERT falla silenciosamente por RLS.

Lo mismo pasa con `ruta_paradas`: al no existir la ruta, las paradas tampoco se pueden insertar.

---

## Solucion

### 1. Migracion SQL: Actualizar politicas RLS

Reemplazar la politica `ALL` por politicas especificas que permitan al chofer crear y gestionar **sus propias rutas**:

**Para `rutas_planificadas`:**
- **INSERT**: Permitir a chofer crear rutas donde `chofer_id = auth.uid()`
- **UPDATE**: Permitir a chofer actualizar sus propias rutas
- **DELETE**: Mantener solo para admin/supervisor/operador

**Para `ruta_paradas`:**
- La politica actual ya permite al chofer gestionar paradas de sus propias rutas (verifica `rp.chofer_id = auth.uid()`), asi que deberia funcionar una vez que la ruta se cree exitosamente.

```sql
-- Eliminar politica ALL restrictiva
DROP POLICY "Gestionar rutas planificadas" ON rutas_planificadas;

-- Nueva politica: admin/supervisor/operador pueden hacer todo
CREATE POLICY "Admin gestionar rutas" ON rutas_planificadas
  FOR ALL TO public
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor') OR has_role(auth.uid(), 'operador'))
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor') OR has_role(auth.uid(), 'operador'));

-- Nueva politica: chofer puede crear y gestionar SUS rutas
CREATE POLICY "Chofer gestionar sus rutas" ON rutas_planificadas
  FOR ALL TO public
  USING (chofer_id = auth.uid() AND has_role(auth.uid(), 'chofer'))
  WITH CHECK (chofer_id = auth.uid() AND has_role(auth.uid(), 'chofer'));
```

### 2. Mejorar el manejo de errores en `useFlexPackages.ts`

Agregar mejor logging del error real de Supabase para facilitar el debug futuro:

```typescript
// Cambiar de:
throw new Error('Error al crear la ruta');

// A:
console.error('Error creating route:', rutaError);
throw new Error(rutaError?.message || 'Error al crear la ruta');
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| Nueva migracion SQL | Actualizar RLS de `rutas_planificadas` para permitir INSERT/UPDATE a choferes |
| `src/hooks/useFlexPackages.ts` | Mejorar mensajes de error con detalles de Supabase |

---

## Sobre el Mapa

El boton "Ver Mapa" funciona segun el codigo. Si el mapa no muestra los paquetes, es posible que los envios no tengan coordenadas (`entrega_lat`/`entrega_lng`). Esto se resuelve automaticamente si las direcciones se geocodifican al crear el envio. No requiere cambios de codigo.

---

## Resultado Esperado

Despues del cambio:
1. El chofer escanea paquetes en Modo Flex
2. Toca "INICIAR REPARTO"
3. Se crea la ruta planificada exitosamente (RLS lo permite porque `chofer_id = auth.uid()`)
4. Las paradas se insertan correctamente
5. Se navega automaticamente a la pantalla de ruta activa

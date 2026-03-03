

# Fix: Congelamiento al crear envío — App se queda trabada después de crear

## Problema confirmado

Los envíos de `bahiablanca@blackbox.com` se crean correctamente en la base de datos (5 hoy, todos `tipo_pago: destino`). El problema ocurre **después** de la creación exitosa:

1. El `onSuccess` del mutation (línea 1232) ejecuta `clearDraft()` sin try/catch
2. Si `clearDraft()` o `queryClient.invalidateQueries()` lanza una excepción, el `navigate()` de la línea 1265 **nunca se ejecuta**
3. React Query atrapa la excepción internamente, el componente queda en estado inconsistente
4. El router de React deja de responder → la app parece "congelada"

Esto pasa en **todos los navegadores y usuarios** porque es un bug de código, no del navegador.

## Solución

### Archivo: `src/pages/NewShipment.tsx`

**1. Proteger `onSuccess` con try/catch** — garantizar que `navigate()` se ejecute siempre:

```typescript
onSuccess: (data) => {
  try { clearDraft(); } catch (e) { console.error('Error clearing draft:', e); }
  
  try {
    queryClient.invalidateQueries({ queryKey: ['envios'] });
    queryClient.invalidateQueries({ queryKey: ['all_clients'] });
    queryClient.invalidateQueries({ queryKey: ['clientes_cta_cte'] });
  } catch (e) { console.error('Error invalidating queries:', e); }
  
  if (formData.tipo_pago === 'contado') {
    setCreatedEnvio({...});
    setShowPaymentModal(true);
  } else {
    // toast + navigate (siempre se ejecuta)
    navigate(`/print-label?id=${data.id}`);
  }
},
```

**2. Agregar `onSettled` como safety net** — si por alguna razón el navigate falla, forzar la redirección después de 3 segundos:

```typescript
onSettled: (data, error) => {
  if (data && !error && formData.tipo_pago !== 'contado') {
    setTimeout(() => {
      if (window.location.pathname.includes('/shipments/new')) {
        navigate(`/print-label?id=${data.id}`, { replace: true });
      }
    }, 3000);
  }
},
```

**3. Agregar handler global de `unhandledrejection` en `App.tsx`** — evitar que promesas no capturadas congelen la app en general.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/NewShipment.tsx` | Envolver `onSuccess` en try/catch, agregar `onSettled` como safety net |
| `src/App.tsx` | Agregar `useEffect` con listener de `unhandledrejection` |


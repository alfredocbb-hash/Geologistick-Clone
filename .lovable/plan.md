

# Plan: Eliminar Conceptos "Recepción" y "Cobros" del Diálogo de Comisiones

## Resumen

Filtrar los conceptos con códigos `recepcion` y `cobros` para que no aparezcan en ninguna de las dos pestañas del diálogo de comisiones de sucursales.

## Cambio Requerido

### Archivo: `src/pages/Branches.tsx`

Agregar un filtro a los conceptos antes de renderizarlos en las tablas de ambas pestañas:

```typescript
// Conceptos a mostrar (excluir recepcion y cobros)
const conceptosFiltrados = conceptos.filter(
  c => !['recepcion', 'cobros'].includes(c.codigo)
);
```

### Lugares a modificar:

1. **useEffect de inicialización** (~líneas 207-239): Usar `conceptosFiltrados` en lugar de `conceptos` para inicializar los datos de emisión y recepción

2. **Tab Emisión** (~línea 1247): Cambiar `conceptos.map(...)` por `conceptosFiltrados.map(...)`

3. **Tab Recepción** (~línea 1351): Cambiar `conceptos.map(...)` por `conceptosFiltrados.map(...)`

4. **Mutación de guardado**: Solo guardar los conceptos que están en `conceptosFiltrados`

## Resultado Visual

Las tablas de comisiones mostrarán solo estos conceptos:

| Concepto | %Cont. | %Dest. | %CC | Base |
|----------|--------|--------|-----|------|
| Flete | 5 | 3 | 4 | Total |
| Seguro | 10 | 8 | 10 | Neto |
| Embalaje | 2 | 2 | 2 | Total |
| Servicio de Agencia | 0 | 0 | 0 | Total |
| Retiro a Domicilio | 0 | 0 | 0 | Total |
| Entrega a Domicilio | 0 | 0 | 0 | Total |
| Traslado | 0 | 0 | 0 | Total |

**"Recepción" y "Cobros" NO aparecerán.**


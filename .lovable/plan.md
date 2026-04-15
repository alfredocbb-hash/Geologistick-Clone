

## Plan: Adaptar Panel Fiscal según Condición IVA

### Problema
El Panel Fiscal siempre muestra el Monitor de Monotributo, que no aplica para Responsable Inscripto. Para un RI, lo importante es:
- **IVA Digital** (débito - crédito = posición mensual) — ya existe
- **Libros IVA** (ventas/compras) — ya existe
- **No mostrar** el monitor de topes de Monotributo

### Solución
Leer la `condicion_iva` desde `arca_config` (vía `useARCAIntegration`) y condicionar la UI:

**Si es `responsable_inscripto`**:
- Mostrar cards de resumen (facturado, gastos, resultado, IIBB)
- Mostrar Reporte IVA Digital (débito vs crédito) — es el módulo central
- **Ocultar** el Monitor de Monotributo
- Agregar card de "Retenciones / Percepciones" como placeholder informativo

**Si es `monotributo`**:
- Mostrar cards de resumen
- Mostrar Reporte IVA Digital simplificado (solo informativo, monotributistas no liquidan IVA)
- **Mostrar** el Monitor de Monotributo con topes

**Si no está configurado** (`arca_config` no existe):
- Mostrar un selector manual "¿Cuál es tu condición IVA?" para elegir qué vista usar

### Cambios en `src/pages/FiscalDashboard.tsx`

1. Importar `useARCAIntegration` del hook existente
2. Leer `config?.condicion_iva` para determinar el modo
3. Si no hay config, agregar un `Select` de condición IVA como state local
4. Condicionar renderizado:
   - `condicion === 'monotributo'` → mostrar Monitor Monotributo
   - `condicion === 'responsable_inscripto'` → ocultar Monitor Monotributo, destacar IVA
5. Ajustar texto del reporte IVA: para monotributistas aclarar que es solo informativo (no liquidan IVA)

### Archivo a modificar
| Archivo | Cambio |
|---------|--------|
| `src/pages/FiscalDashboard.tsx` | Condicionar secciones según `condicion_iva` |


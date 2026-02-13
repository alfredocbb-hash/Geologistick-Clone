

# Fix: Imprimir usando window.print() en la pagina actual

## Problema

La app corre dentro del iframe de preview del navegador. Tanto `window.open` como crear un `<iframe>` oculto resultan en llamadas a `print()` desde contextos anidados que muchos navegadores bloquean silenciosamente. Por eso el dialogo de impresion no aparece o la impresora no recibe la orden.

## Solucion

Usar `window.print()` directamente sobre la pagina actual. Para eso:

1. Inyectar un div oculto con el HTML de las etiquetas
2. Usar CSS `@media print` para ocultar toda la UI normal y mostrar solo ese div
3. Llamar `window.print()` directamente
4. Limpiar el div despues de imprimir

## Cambios en `src/pages/PrintLabel.tsx`

### 1. Agregar un contenedor de impresion en el JSX (antes del return, linea ~745)

Agregar un div con `id="print-labels-container"` que normalmente esta oculto:

```tsx
<div id="print-labels-container" className="hidden print:block" 
     dangerouslySetInnerHTML={{ __html: printHTML }} />
```

### 2. Agregar estado para el HTML de impresion

```typescript
const [printHTML, setPrintHTML] = useState('');
```

### 3. Reemplazar la funcion `handlePrint` (lineas 598-679)

En vez de crear iframe o popup:

```typescript
const handlePrint = () => {
  if (!envio) return;
  setIsPrinting(true);

  // ... misma logica de tipoConfig, getDeliveryAddress, generateLabelHTML ...

  // Inyectar el contenido en un div oculto
  const printContainer = document.createElement('div');
  printContainer.id = 'print-labels-area';
  printContainer.innerHTML = labelHTML;
  document.body.appendChild(printContainer);

  // Agregar estilos de impresion temporales
  const printStyle = document.createElement('style');
  printStyle.id = 'print-labels-style';
  printStyle.textContent = `
    @media print {
      body > *:not(#print-labels-area) { display: none !important; }
      #print-labels-area { display: block !important; }
    }
    #print-labels-area { display: none; }
  `;
  document.head.appendChild(printStyle);

  // Esperar renderizado y luego imprimir
  requestAnimationFrame(() => {
    setTimeout(() => {
      window.print();
      // Limpiar despues de imprimir
      document.body.removeChild(printContainer);
      document.head.removeChild(printStyle);
      setIsPrinting(false);
    }, 300);
  });
};
```

### 4. Actualizar texto de ayuda (linea 789)

Cambiar "se abrira una ventana nueva" por "se abrira el dialogo de impresion".

## Por que funciona

- `window.print()` se llama en el contexto principal del documento, no desde un iframe o popup anidado
- El navegador siempre respeta `window.print()` en el documento actual
- Los estilos `@media print` ocultan la UI y muestran solo las etiquetas
- Despues de imprimir/cancelar, se limpia todo y la pagina vuelve a la normalidad

## Archivo modificado

Solo `src/pages/PrintLabel.tsx`


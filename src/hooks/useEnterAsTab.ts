import { useCallback } from 'react';

/**
 * Hook que permite usar la tecla Enter como Tab en formularios.
 * Al presionar Enter en un campo, el foco se mueve al siguiente campo en lugar de enviar el formulario.
 * 
 * Uso:
 * ```tsx
 * const { handleKeyDown } = useEnterAsTab();
 * 
 * return (
 *   <form onKeyDown={handleKeyDown}>
 *     <Input name="campo1" />
 *     <Input name="campo2" />
 *     <Button type="submit">Guardar</Button>
 *   </form>
 * );
 * ```
 */
export function useEnterAsTab() {
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLFormElement | HTMLDivElement>) => {
    // Solo actuar si es la tecla Enter
    if (e.key !== 'Enter') return;
    
    // Obtener el elemento activo
    const target = e.target as HTMLElement;
    
    // No interferir con textareas (permitir Enter para nueva línea)
    if (target.tagName === 'TEXTAREA') return;
    
    // No interferir con botones (permitir Enter para activar)
    if (target.tagName === 'BUTTON') return;
    
    // No interferir si tiene type="submit"
    if ((target as HTMLInputElement).type === 'submit') return;
    
    // Buscar el contenedor del formulario
    const form = e.currentTarget;
    
    // Obtener todos los elementos focusables
    const focusableElements = Array.from(
      form.querySelectorAll<HTMLElement>(
        'input:not([type="submit"]):not([type="button"]):not([type="hidden"]):not([disabled]):not([readonly]), ' +
        'select:not([disabled]), ' +
        'textarea:not([disabled]), ' +
        '[tabindex]:not([tabindex="-1"]):not([disabled])'
      )
    ).filter(el => {
      // Filtrar elementos ocultos
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });

    // Encontrar el índice del elemento actual
    const currentIndex = focusableElements.indexOf(target as HTMLElement);

    // Si encontramos el elemento y no es el último
    if (currentIndex > -1 && currentIndex < focusableElements.length - 1) {
      e.preventDefault();
      e.stopPropagation();
      
      const nextElement = focusableElements[currentIndex + 1];
      nextElement.focus();
      
      // Si es un input, seleccionar el contenido para fácil reemplazo
      if (nextElement.tagName === 'INPUT' && (nextElement as HTMLInputElement).select) {
        (nextElement as HTMLInputElement).select();
      }
    } else if (currentIndex === focusableElements.length - 1) {
      // Último campo: prevenir envío accidental
      e.preventDefault();
    }
  }, []);

  return { handleKeyDown };
}

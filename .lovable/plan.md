

# Plan: Corregir Sección de Logos de Clientes

## Problemas Identificados

1. **Logos muy pequeños**: El tamaño actual `max-h-12` (48px) es muy reducido
2. **Contenedor limitado**: `h-16 w-40` restringe el espacio disponible
3. **Falta de centrado**: Los logos no están centrados cuando hay pocos clientes
4. **Efecto marquee incompleto**: Cuando hay pocos logos, el efecto de scroll infinito no funciona correctamente

## Datos Actuales en Base de Datos

Hay 3 empresas con logos configurados:
- Beraexpress
- BlackBox Cargas  
- PlataBus Cargas

## Solucion Propuesta

### Archivo: `src/components/landing/Clients.tsx`

**Cambios a realizar:**

1. **Aumentar tamano de logos**
   - Cambiar `max-h-12` a `max-h-20` (80px)
   - Cambiar `h-16 w-40` a `h-24 w-48` para el contenedor

2. **Mejorar centrado del contenedor**
   - Agregar centrado con `justify-center` cuando hay pocos logos
   - Usar flexbox centrado para el container del marquee

3. **Ajustar espaciado entre logos**
   - Cambiar `mx-12` a `mx-16` para mejor separacion

4. **Duplicar logos multiples veces para efecto fluido**
   - Triplicar o cuadruplicar la lista de logos para asegurar continuidad del scroll

5. **Mantener efectos visuales**
   - Conservar grayscale con hover a color
   - Mantener fade en bordes izquierdo/derecho
   - Mantener pausa en hover

---

## Cambios Especificos

```text
Antes:
- h-16 w-40 (altura 64px, ancho 160px)
- max-h-12 (max altura logo 48px)
- mx-12 (margen horizontal 48px)
- 2 copias de logos (original + duplicado)

Despues:
- h-24 w-52 (altura 96px, ancho 208px)  
- max-h-20 (max altura logo 80px)
- mx-16 (margen horizontal 64px)
- 4 copias de logos para scroll continuo
```

---

## Estructura Visual Final

```text
|  [fade] [Logo1] [Logo2] [Logo3] [Logo1] [Logo2] [Logo3] ... [fade]  |
                         <-- scroll continuo -->
```

Con logos mas grandes, centrados, y animacion fluida.


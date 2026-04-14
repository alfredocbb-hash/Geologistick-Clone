

## Plan: Agregar selector de idioma en la página principal (Landing)

### Cambio
Agregar el componente `LanguageSelector` al Navbar de la landing page, junto al `ThemeToggle` existente.

### Archivo a modificar
| Archivo | Cambio |
|---------|--------|
| `src/components/landing/Navbar.tsx` | Importar `LanguageSelector` y agregarlo en desktop (junto a ThemeToggle) y en mobile menu |

### Detalle
- Desktop: colocar `<LanguageSelector variant="ghost" />` al lado del `<ThemeToggle />` en la sección de CTA
- Mobile: agregarlo en el menú móvil junto al ThemeToggle existente




# Plan: Fix driver markers not visible on Live Map

## Root Cause

In `MapView.tsx` (line 66), the `getMarkerIcon` function maps `'driver'` to the URL `https://maps.google.com/mapfiles/ms/icons/truck.png`. This URL **does not exist** in Google's hosted marker icon set. When Google Maps can't load the icon, the marker simply doesn't render, making all drivers invisible on the map.

## Fix

### Modify: `src/components/maps/MapView.tsx` (line 66)

Replace the invalid `truck.png` URL with a valid, distinctive icon for drivers. Options:

```typescript
const icons = {
  origin: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
  destination: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
  branch: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
  current: 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
  warning: 'https://maps.google.com/mapfiles/ms/icons/grey-dot.png',
  driver: 'https://maps.google.com/mapfiles/kml/shapes/cabs.png',
};
```

The URL `https://maps.google.com/mapfiles/kml/shapes/cabs.png` is a valid Google-hosted vehicle/cab icon that will render correctly on the map.

One-line change. No backend modifications needed.


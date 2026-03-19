

## Plan: Fix Dashboard Mini Map API Key Error

### Problem
The `DashboardMiniMap` component uses a **hardcoded Google Maps API key** in an iframe embed URL (line 55). This key is not authorized for the current domain, causing the "Google Maps Platform rejected your request" error.

### Solution

**File:** `src/components/dashboard/DashboardMiniMap.tsx`

Replace the hardcoded iframe embed with a proper Google Maps component using the existing `GoogleMapsProvider` infrastructure (which already fetches the correct API key per tenant).

Changes:
- Import `useGoogleMaps` from `GoogleMapsProvider` and `GoogleMap` / `Marker` from `@react-google-maps/api`
- Replace the `<iframe>` with a `<GoogleMap>` component that plots markers for each branch using their `lat/lng` coordinates
- Auto-fit bounds to show all branch markers
- Show a fallback message if Google Maps is not loaded yet (API key loading or error)

This reuses the same secure API key flow that all other map components use, avoiding hardcoded keys entirely.

### Files to modify

| File | Change |
|------|--------|
| `src/components/dashboard/DashboardMiniMap.tsx` | Replace iframe embed with `GoogleMap` + `Marker` using `useGoogleMaps()` |


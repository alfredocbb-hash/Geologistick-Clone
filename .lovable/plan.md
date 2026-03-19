

## Plan: Remove straight-line polyline overlay on Live Map

### Problem
When viewing a driver's route on the Choferes tab, two polylines render simultaneously:
1. The driver's actual route (`polylinePath`) — which can fall back to snapped/raw GPS points, creating **straight-line segments** between points
2. The planned route (`secondaryPolylinePath`) — follows streets via Directions API

When `polylinePath` falls back to snapped or raw GPS data (if Directions API is slow or fails), it draws straight lines between GPS points that overlap the street-level planned route.

### Solution
**File:** `src/hooks/useDriverRoute.ts`

Change the `polylinePath` computation to only return data when the Directions API result is available. Remove the fallback to snapped/raw points, which is what creates the ugly straight lines:

```typescript
// Before (falls back to straight lines):
const polylinePath = useMemo(() => {
  if (directionsRoute.length > 0) return directionsRoute;
  if (snappedRoute.length > 0) return snappedRoute;
  return rawHistory.map(point => ({ lat: point.lat, lng: point.lng }));
}, [rawHistory, snappedRoute, directionsRoute]);

// After (only street-level or nothing):
const polylinePath = useMemo(() => {
  if (directionsRoute.length > 0) return directionsRoute;
  return [];
}, [directionsRoute]);
```

This means: if the Directions API hasn't returned yet or fails, no polyline renders — avoiding the overlapping straight lines entirely. The planned route (dashed blue) still shows the street-level path.

### Files to modify

| File | Change |
|------|--------|
| `src/hooks/useDriverRoute.ts` | Remove snapped/raw fallback from `polylinePath` — only use directionsRoute |


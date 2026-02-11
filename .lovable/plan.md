
## Fix: Driver Can't Proceed After Reporting Incident

### Problem
When a driver reports an incident (e.g., "client absent") on a shipment, the app correctly moves the "Next Stop" indicator to the next pending delivery. However, the **stop list** and **map** still show the incident shipment as "not completed" because the `isCompleted` check doesn't include the `incidencia` status. This confuses the driver and makes it seem like they're stuck.

### Root Cause
In `ActiveRouteNavigation.tsx`, there are 3 places where shipment completion is checked, but only 2 of them include `incidencia`:

- `stats` calculation (line 259): Includes `incidencia` -- correct
- `nextStop` calculation (line 280): Skips `incidencia` -- correct  
- `isCompleted` in the stop list (line 735): Does NOT include `incidencia` -- **BUG**
- `isCompleted` in map markers (line 305): Does NOT include `incidencia` -- **BUG**
- `navigateFullRoute` filter (line 398): Does NOT exclude `incidencia` -- **BUG**

### Fix

**File: `src/pages/ActiveRouteNavigation.tsx`**

1. **Stop list `isCompleted` check** (line 735) - Add `incidencia` status:
```typescript
// Before:
const isCompleted = envio.estado === 'entregado' || envio.estado === 'devuelto' || envio.estado_retiro === 'retirado';

// After:
const isCompleted = envio.estado === 'entregado' || envio.estado === 'devuelto' || envio.estado === 'incidencia' || envio.estado_retiro === 'retirado';
```

2. **Map markers `isCompleted` check** (line 305) - Same fix:
```typescript
// Before:
const isCompleted = envio.estado === 'entregado' || envio.estado === 'devuelto' || envio.estado_retiro === 'retirado';

// After:
const isCompleted = envio.estado === 'entregado' || envio.estado === 'devuelto' || envio.estado === 'incidencia' || envio.estado_retiro === 'retirado';
```

3. **Google Maps route filter** (line 393-398) - Exclude `incidencia` from pending stops:
```typescript
// Before:
return envio.estado !== 'entregado' && envio.estado !== 'devuelto';

// After:
return envio.estado !== 'entregado' && envio.estado !== 'devuelto' && envio.estado !== 'incidencia';
```

### Result
After these changes, when a driver reports an incident or marks "client absent":
- The stop will immediately appear greyed out (completed) in the list
- The "Next Stop" card will show the next pending delivery
- The Google Maps navigation will skip incident stops
- The driver can seamlessly continue with remaining deliveries

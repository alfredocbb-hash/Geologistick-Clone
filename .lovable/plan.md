

# Plan: Fix black screen crash in Route Planner

## Root Cause
The `DeliveryStopMarker` component (line 24-26) crashes when `time` is a non-empty but invalid date string. `new Date(time)` produces an invalid Date, and `date-fns` `format()` throws `RangeError: Invalid time value`. Since there's no error boundary, this crashes the entire React tree → black screen.

## Fix

### Modify: `src/components/maps/DeliveryStopMarker.tsx` (line 24-26)
Add a validity check before formatting:

```typescript
const parsedDate = time ? new Date(time) : null;
const formattedTime = parsedDate && !isNaN(parsedDate.getTime())
  ? format(parsedDate, "HH:mm", { locale: es })
  : '';
```

One-file, 3-line change. No backend or other component changes needed.


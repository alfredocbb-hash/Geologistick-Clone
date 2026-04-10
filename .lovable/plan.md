

## Plan: Fix ExchangeDialog not appearing + Photo stability

### Issue 1: ExchangeDialog (devolución) never appears after delivery

**Root cause**: In `DeliveryConfirmation.tsx` line 551-552, `onSuccess()` is called BEFORE `setShowExchangeDialog(true)`. The `onSuccess` callback in `ActiveRouteNavigation.tsx` (line 1042) calls `closeDialog()`, which sets `selectedShipment = null` and `dialogType = null`. This **unmounts** `DeliveryConfirmation` entirely (because of the conditional `selectedShipment && dialogType === 'delivery'` on line 1037). So `showExchangeDialog` never renders because the component is already gone.

**Fix**: In `DeliveryConfirmation.tsx`, don't call `onSuccess()` immediately. Instead, show the ExchangeDialog first, and only call `onSuccess()` + `onClose()` when the ExchangeDialog closes.

```
// Line 550-552 currently:
toast.success('¡Entrega confirmada exitosamente!');
onSuccess();                        // ← unmounts component!
setShowExchangeDialog(true);        // ← never renders

// Fix:
toast.success('¡Entrega confirmada exitosamente!');
setShowExchangeDialog(true);        // ← show exchange dialog first
// onSuccess() will be called when ExchangeDialog closes
```

And update the ExchangeDialog `onClose` callback (line 884-886) to also call `onSuccess()`:
```tsx
onClose={() => {
  setShowExchangeDialog(false);
  onSuccess();  // ← notify parent AFTER exchange flow completes
  onClose();
}}
```

### Issue 2: Photo "se sale" after preview

This is likely caused by the Android WebView reload when opening the native camera. The `sessionStorage` persistence is in place but the dialog gets re-rendered. The current code on line 104 removes the storage key immediately after restoring (`sessionStorage.removeItem(STORAGE_KEY)`), which is correct. However, if the component unmounts and remounts during the WebView reload cycle, the state may not survive. This should be stable with the existing persistence logic but I'll verify the flow isn't being interrupted by a parent re-render.

### Files to modify

| File | Change |
|---|---|
| `src/components/delivery/DeliveryConfirmation.tsx` | Don't call `onSuccess()` before ExchangeDialog; call it when ExchangeDialog closes |

### Impact
- No DB, RLS, or security changes
- Only changes the order of callbacks in the delivery confirmation flow


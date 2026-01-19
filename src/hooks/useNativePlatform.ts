import { Capacitor } from '@capacitor/core';

export function useNativePlatform() {
  // Use ONLY Capacitor's official detection - no URL or localStorage heuristics
  const capacitorPlatform = Capacitor.getPlatform();
  const isCapacitorNative = Capacitor.isNativePlatform();
  
  // Stricter WebView detection to avoid false positives on mobile browsers
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Only detect as Android WebView if:
  // 1. Has explicit 'wv' marker (WebView identifier), OR
  // 2. Has 'version/' which indicates stock Android browser OR WebView, AND doesn't have Chrome identifier, OR
  // 3. Has explicit Android JavaScript bridge
  const isAndroidWebView = 
    userAgent.includes('; wv)') || // Explicit WebView marker with proper context
    (typeof (window as any).Android !== 'undefined'); // Capacitor Android bridge
  
  // iOS WebView detection - only if NOT Safari and NOT Chrome iOS
  const isIOSWebView = 
    (userAgent.includes('iphone') || userAgent.includes('ipad')) &&
    !userAgent.includes('safari') && 
    !userAgent.includes('crios') &&
    !userAgent.includes('fxios'); // Also exclude Firefox iOS
  
  // Only trust Capacitor's isNativePlatform() OR confirmed WebView detection
  const isNative = isCapacitorNative || isAndroidWebView || isIOSWebView;
  const isWeb = !isNative;
  
  // isAndroid/isIOS detection - CRITICAL: Include WebView detection for remote URL scenarios
  // When Capacitor loads a remote URL, getPlatform() may return "web" but we're still in Android WebView
  const isAndroid = capacitorPlatform === 'android' || 
    (isCapacitorNative && userAgent.includes('android')) ||
    isAndroidWebView; // If we detected Android WebView, we ARE on Android
    
  const isIOS = capacitorPlatform === 'ios' || 
    (isCapacitorNative && (userAgent.includes('iphone') || userAgent.includes('ipad'))) ||
    isIOSWebView; // If we detected iOS WebView, we ARE on iOS
  
  // Platform string - prioritize detected platform over Capacitor's report
  const platform = isAndroid ? 'android' : isIOS ? 'ios' : capacitorPlatform;
  
  return { isNative, isAndroid, isIOS, isWeb, platform };
}

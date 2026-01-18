import { Capacitor } from '@capacitor/core';

export function useNativePlatform() {
  const capacitorPlatform = Capacitor.getPlatform();
  
  // Enhanced detection for Capacitor WebView
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Check if loaded from Capacitor app via URL or stored flag
  const isLoadedInCapacitorApp = 
    window.location.href.includes('forceHideBadge=true') ||
    window.location.href.includes('geologic.lovable.app') ||
    localStorage.getItem('capacitor-native') === 'true' ||
    document.referrer.includes('capacitor://') ||
    window.location.href.includes('lovableproject.com');
  
  // Store flag for future visits within the app
  if (isLoadedInCapacitorApp && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('capacitor-native', 'true');
    } catch (e) {
      // Ignore localStorage errors
    }
  }
  
  const isAndroidWebView = 
    userAgent.includes('wv') || 
    (userAgent.includes('android') && userAgent.includes('version/')) ||
    (typeof (window as any).Android !== 'undefined') ||
    (userAgent.includes('android') && !userAgent.includes('chrome/'));
  
  const isIOSWebView = 
    (userAgent.includes('iphone') || userAgent.includes('ipad')) &&
    !userAgent.includes('safari') && !userAgent.includes('crios');
  
  const isCapacitorNative = 
    typeof (window as any).Capacitor?.isNativePlatform === 'function' 
      ? (window as any).Capacitor.isNativePlatform() 
      : false;
  
  const isAndroid = capacitorPlatform === 'android' || isAndroidWebView || 
    (isLoadedInCapacitorApp && userAgent.includes('android'));
  const isIOS = capacitorPlatform === 'ios' || isIOSWebView ||
    (isLoadedInCapacitorApp && (userAgent.includes('iphone') || userAgent.includes('ipad')));
  const isNative = capacitorPlatform !== 'web' || isCapacitorNative || isAndroidWebView || isIOSWebView || isLoadedInCapacitorApp;
  const isWeb = !isNative;
  
  const platform = isAndroid ? 'android' : isIOS ? 'ios' : capacitorPlatform;
  
  return { isNative, isAndroid, isIOS, isWeb, platform };
}

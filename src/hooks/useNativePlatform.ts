import { Capacitor } from '@capacitor/core';

export function useNativePlatform() {
  // Use ONLY Capacitor's official detection - no URL or localStorage heuristics
  const capacitorPlatform = Capacitor.getPlatform();
  const isCapacitorNative = Capacitor.isNativePlatform();
  
  // Fallback detection for WebView environments where Capacitor might not initialize properly
  const userAgent = navigator.userAgent.toLowerCase();
  
  const isAndroidWebView = 
    userAgent.includes('wv') || 
    (userAgent.includes('android') && userAgent.includes('version/')) ||
    (typeof (window as any).Android !== 'undefined') ||
    (userAgent.includes('android') && !userAgent.includes('chrome/'));
  
  const isIOSWebView = 
    (userAgent.includes('iphone') || userAgent.includes('ipad')) &&
    !userAgent.includes('safari') && !userAgent.includes('crios');
  
  // isNative is TRUE only when:
  // 1. Capacitor explicitly says we're native, OR
  // 2. We detect a native WebView environment
  const isAndroid = capacitorPlatform === 'android' || (isCapacitorNative && userAgent.includes('android'));
  const isIOS = capacitorPlatform === 'ios' || (isCapacitorNative && (userAgent.includes('iphone') || userAgent.includes('ipad')));
  const isNative = isCapacitorNative || capacitorPlatform !== 'web' || isAndroidWebView || isIOSWebView;
  const isWeb = !isNative;
  
  const platform = isAndroid ? 'android' : isIOS ? 'ios' : capacitorPlatform;
  
  return { isNative, isAndroid, isIOS, isWeb, platform };
}

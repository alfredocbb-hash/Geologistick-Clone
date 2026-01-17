import { Capacitor } from '@capacitor/core';

export function useNativePlatform() {
  const capacitorPlatform = Capacitor.getPlatform();
  
  // Enhanced detection for Capacitor WebView
  const userAgent = navigator.userAgent.toLowerCase();
  
  const isAndroidWebView = 
    userAgent.includes('wv') || 
    (userAgent.includes('android') && userAgent.includes('version/')) ||
    (typeof (window as any).Android !== 'undefined');
  
  const isIOSWebView = 
    (userAgent.includes('iphone') || userAgent.includes('ipad')) &&
    !userAgent.includes('safari') && !userAgent.includes('crios');
  
  const isCapacitorNative = 
    typeof (window as any).Capacitor?.isNativePlatform === 'function' 
      ? (window as any).Capacitor.isNativePlatform() 
      : false;
  
  const isAndroid = capacitorPlatform === 'android' || isAndroidWebView;
  const isIOS = capacitorPlatform === 'ios' || isIOSWebView;
  const isNative = capacitorPlatform !== 'web' || isCapacitorNative || isAndroidWebView || isIOSWebView;
  const isWeb = !isNative;
  
  const platform = isAndroid ? 'android' : isIOS ? 'ios' : capacitorPlatform;
  
  return { isNative, isAndroid, isIOS, isWeb, platform };
}

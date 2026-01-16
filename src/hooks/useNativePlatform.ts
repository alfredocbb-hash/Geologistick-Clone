import { Capacitor } from '@capacitor/core';

export function useNativePlatform() {
  const platform = Capacitor.getPlatform();
  const isNative = platform === 'android' || platform === 'ios';
  const isAndroid = platform === 'android';
  const isIOS = platform === 'ios';
  const isWeb = platform === 'web';
  
  return { 
    isNative, 
    isAndroid, 
    isIOS, 
    isWeb,
    platform 
  };
}

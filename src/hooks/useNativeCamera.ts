import { useCallback, useEffect, useRef, useState } from 'react';
import { useNativePlatform } from './useNativePlatform';

interface CameraResult {
  dataUrl: string;
}

// Cache the module at module level so we only try once
let cameraModulePromise: Promise<any> | null = null;
let cameraModule: any = null;
let cameraImportFailed = false;

function getCameraModule() {
  if (cameraModule) return Promise.resolve(cameraModule);
  if (cameraImportFailed) return Promise.resolve(null);
  if (!cameraModulePromise) {
    cameraModulePromise = import('@capacitor/camera')
      .then((mod) => {
        cameraModule = mod;
        console.log('[useNativeCamera] @capacitor/camera loaded successfully');
        return mod;
      })
      .catch((err) => {
        cameraImportFailed = true;
        console.warn('[useNativeCamera] @capacitor/camera import failed (expected in remote WebView):', err?.message || err);
        return null;
      });
  }
  return cameraModulePromise;
}

export function useNativeCamera() {
  const { isNative } = useNativePlatform();
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);

  // Try to load the module on mount
  useEffect(() => {
    if (!isNative) {
      setCameraAvailable(false);
      return;
    }
    getCameraModule().then((mod) => {
      setCameraAvailable(!!mod);
    });
  }, [isNative]);

  const takePhoto = useCallback(async (): Promise<CameraResult | null> => {
    const mod = await getCameraModule();
    if (!mod) return null;

    try {
      const { Camera, CameraResultType, CameraSource, CameraDirection } = mod;
      const result = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        direction: CameraDirection.Rear,
        width: 1280,
        correctOrientation: true,
      });

      if (result.dataUrl) {
        return { dataUrl: result.dataUrl };
      }
      return null;
    } catch (error: any) {
      if (error?.message?.includes('cancelled') || error?.message?.includes('denied')) {
        console.log('[useNativeCamera] Camera cancelled or denied:', error.message);
        return null;
      }
      console.error('[useNativeCamera] Native camera error:', error);
      return null;
    }
  }, []);

  const pickFromGallery = useCallback(async (): Promise<CameraResult | null> => {
    const mod = await getCameraModule();
    if (!mod) return null;

    try {
      const { Camera, CameraResultType, CameraSource } = mod;
      const result = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        width: 1280,
        correctOrientation: true,
      });

      if (result.dataUrl) {
        return { dataUrl: result.dataUrl };
      }
      return null;
    } catch (error: any) {
      if (error?.message?.includes('cancelled') || error?.message?.includes('denied')) {
        console.log('[useNativeCamera] Gallery cancelled or denied:', error.message);
        return null;
      }
      console.error('[useNativeCamera] Native gallery error:', error);
      return null;
    }
  }, []);

  return { isNative, cameraAvailable: cameraAvailable === true, takePhoto, pickFromGallery };
}

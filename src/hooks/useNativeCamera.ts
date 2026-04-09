import { useCallback, useEffect, useState } from 'react';
import { useNativePlatform } from './useNativePlatform';

interface CameraResult {
  dataUrl?: string;
  webPath?: string;
}

let cameraModulePromise: Promise<any> | null = null;
let cameraModule: any = null;

function getCameraModule() {
  if (cameraModule) return Promise.resolve(cameraModule);
  if (!cameraModulePromise) {
    cameraModulePromise = import('@capacitor/camera').then((mod) => {
      cameraModule = mod;
      return mod;
    });
  }
  return cameraModulePromise;
}

export function useNativeCamera() {
  const { isNative } = useNativePlatform();
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isNative) {
      setCameraAvailable(false);
      return;
    }
    getCameraModule().then((mod) => setCameraAvailable(!!mod));
  }, [isNative]);

  const takePhoto = useCallback(async (): Promise<CameraResult | null> => {
    const mod = await getCameraModule();
    if (!mod) return null;

    try {
      const { Camera, CameraResultType, CameraSource, CameraDirection } = mod;

      // OPTIMIZACIÓN EXTREMA PARA ANDROID
      const result = await Camera.getPhoto({
        quality: 40,
        allowEditing: false,
        resultType: CameraResultType.DataUrl, // DataUrl sobrevive reciclado de WebView
        source: CameraSource.Camera,
        direction: CameraDirection.Rear,
        width: 800,
        correctOrientation: true,
        saveToGallery: false
      });

      return {
        webPath: result.webPath,
        dataUrl: result.dataUrl // Podría ser undefined con Uri
      };
    } catch (error: any) {
      console.error('[useNativeCamera] Camera Error:', error);
      return null;
    }
  }, []);

  const pickFromGallery = useCallback(async (): Promise<CameraResult | null> => {
    const mod = await getCameraModule();
    if (!mod) return null;
    try {
      const { Camera, CameraResultType, CameraSource } = mod;
      const result = await Camera.getPhoto({
        quality: 50,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        width: 1000,
      });
      return { dataUrl: result.dataUrl };
    } catch (e) { return null; }
  }, []);

  return { isNative, cameraAvailable: cameraAvailable === true, takePhoto, pickFromGallery };
}

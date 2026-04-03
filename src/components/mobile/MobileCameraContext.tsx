import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface MobileCameraContextType {
  isCameraActive: boolean;
  setCameraActive: (active: boolean) => void;
}

const MobileCameraContext = createContext<MobileCameraContextType>({
  isCameraActive: false,
  setCameraActive: () => {},
});

export function MobileCameraProvider({ children }: { children: ReactNode }) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const setCameraActive = useCallback((active: boolean) => setIsCameraActive(active), []);

  return (
    <MobileCameraContext.Provider value={{ isCameraActive, setCameraActive }}>
      {children}
    </MobileCameraContext.Provider>
  );
}

export function useMobileCamera() {
  return useContext(MobileCameraContext);
}

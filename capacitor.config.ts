import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.53354d35df094ff79101b454344485d4',
  appName: 'ChoferApp',
  webDir: 'dist',
  server: {
    url: 'https://53354d35-df09-4ff7-9101-b454344485d4.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1e293b',
      showSpinner: true,
      spinnerColor: '#3b82f6'
    }
  }
};

export default config;

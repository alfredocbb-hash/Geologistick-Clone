import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import esCommon from './locales/es/common.json';
import esAuth from './locales/es/auth.json';
import esDashboard from './locales/es/dashboard.json';
import esTracking from './locales/es/tracking.json';
import esMobile from './locales/es/mobile.json';
import esLanding from './locales/es/landing.json';

import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enDashboard from './locales/en/dashboard.json';
import enTracking from './locales/en/tracking.json';
import enMobile from './locales/en/mobile.json';
import enLanding from './locales/en/landing.json';

import ptCommon from './locales/pt/common.json';
import ptAuth from './locales/pt/auth.json';
import ptDashboard from './locales/pt/dashboard.json';
import ptTracking from './locales/pt/tracking.json';
import ptMobile from './locales/pt/mobile.json';
import ptLanding from './locales/pt/landing.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { common: esCommon, auth: esAuth, dashboard: esDashboard, tracking: esTracking, mobile: esMobile, landing: esLanding },
      en: { common: enCommon, auth: enAuth, dashboard: enDashboard, tracking: enTracking, mobile: enMobile, landing: enLanding },
      pt: { common: ptCommon, auth: ptAuth, dashboard: ptDashboard, tracking: ptTracking, mobile: ptMobile, landing: ptLanding },
    },
    defaultNS: 'common',
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
  });

export default i18n;

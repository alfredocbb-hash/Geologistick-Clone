import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import esCommon from './locales/es/common.json';
import esAuth from './locales/es/auth.json';
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import ptCommon from './locales/pt/common.json';
import ptAuth from './locales/pt/auth.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { common: esCommon, auth: esAuth },
      en: { common: enCommon, auth: enAuth },
      pt: { common: ptCommon, auth: ptAuth },
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

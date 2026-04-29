import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enTranslation from "../../public/locales/en/translation.json";
import esTranslation from "../../public/locales/es/translation.json";
import frTranslation from "../../public/locales/fr/translation.json";
import deTranslation from "../../public/locales/de/translation.json";
import srLatnTranslation from "../../public/locales/sr-Latn/translation.json";

const resources = {
  en: { translation: enTranslation },
  es: { translation: esTranslation },
  fr: { translation: frTranslation },
  de: { translation: deTranslation },
  "sr-Latn": { translation: srLatnTranslation },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: ["en", "es", "fr", "de", "sr-Latn"],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

export type Language = 'en' | 'ar';

export interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  dir: 'ltr' | 'rtl';
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'skywings_lang';

function applyLanguage(lang: Language): void {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
}

function resolveInitialLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'ar') {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  const browserLang = navigator.language?.slice(0, 2);
  if (browserLang === 'ar') return 'ar';
  return 'en';
}

export interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps): JSX.Element {
  const [language, setLanguageState] = useState<Language>(resolveInitialLanguage);

  useEffect(() => {
    applyLanguage(language);
  }, [language]);

  const setLanguage = useCallback((lang: Language): void => {
    setLanguageState(lang);
    applyLanguage(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const dir: 'ltr' | 'rtl' = language === 'ar' ? 'rtl' : 'ltr';

  return (
    <I18nContext.Provider value={{ language, setLanguage, dir }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
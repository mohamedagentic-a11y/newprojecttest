import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

type Language = 'en' | 'ar';

interface LanguageContextValue {
  lang: Language;
  dir: 'ltr' | 'rtl';
  toggleLanguage: () => void;
}

const STORAGE_KEY = 'skywings_lang';

function getInitialLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'ar') {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return 'en';
}

function applyLanguageToDocument(lang: Language): void {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', dir);
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [lang, setLang] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    applyLanguageToDocument(lang);
  }, [lang]);

  const toggleLanguage = useCallback(() => {
    setLang((current) => {
      const next: Language = current === 'en' ? 'ar' : 'en';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // localStorage unavailable
      }
      applyLanguageToDocument(next);
      return next;
    });
  }, []);

  const dir: 'ltr' | 'rtl' = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <LanguageContext.Provider value={{ lang, dir, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (ctx === null) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}